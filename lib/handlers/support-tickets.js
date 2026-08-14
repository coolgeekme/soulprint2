import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { generateToken, hashPassword, comparePassword, verifyToken, getTokenFromRequest } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { getProvider } from '@/lib/llm/providers';

// ============================================================
// SUPPORT TICKET SYSTEM
// ============================================================
// Workflow:
//   1. User submits issue via in-app support or support person pastes email
//   2. AI diagnoses the issue (DB lookup + pattern matching)
//   3. Generates a report with suggested fix
//   4. Superadmin reviews and approves/rejects fixes
//   5. Data-level fixes auto-execute; code-level fixes get documented
// ============================================================

const TICKET_STATUSES = ['new', 'diagnosing', 'diagnosed', 'fix_pending', 'fix_approved', 'fix_applied', 'needs_development', 'resolved', 'closed'];

const FIX_TYPES = {
  DATA_FIX: 'data_fix',       // Can be auto-applied (DB updates)
  CODE_FIX: 'code_fix',       // Needs Emergent development session
  USER_ACTION: 'user_action',  // User needs to do something (clear cache, etc.)
  NO_FIX: 'no_fix',           // Not a bug / already resolved
};

// Known issue patterns for quick diagnosis
const KNOWN_PATTERNS = [
  {
    patterns: [/can'?t\s+log\s*in/i, /login\s+(fail|error|issue|problem)/i, /password\s+(wrong|incorrect|reset)/i, /unauthorized/i],
    category: 'auth',
    quickDiagnosis: 'Authentication/Login Issue',
    checks: ['user_exists', 'password_valid', 'account_accepted'],
  },
  {
    patterns: [/video\s+(stuck|fail|error|not\s+generating|broken|loading)/i, /animation\s+(fail|error|stuck)/i],
    category: 'media_video',
    quickDiagnosis: 'Video Generation Issue',
    checks: ['video_jobs_status', 'api_key_valid'],
  },
  {
    patterns: [/image\s+(fail|error|not\s+generating|broken|wrong|blurry)/i, /photo\s+(fail|error)/i, /picture\s+(fail|error)/i],
    category: 'media_image',
    quickDiagnosis: 'Image Generation Issue',
    checks: ['recent_image_errors', 'api_key_valid'],
  },
  {
    patterns: [/data\s*(loss|lost|missing|gone|disappeared)/i, /messages?\s*(gone|missing|lost|disappeared)/i, /conversation\s*(gone|missing|lost)/i],
    category: 'data_loss',
    quickDiagnosis: 'Data Loss / Missing Content',
    checks: ['db_connection', 'user_messages_count'],
  },
  {
    patterns: [/invite\s*(code|link)?\s*(not\s*work|fail|error|invalid|expired)/i, /register\s*(fail|error)/i, /sign\s*up\s*(fail|error)/i],
    category: 'invite',
    quickDiagnosis: 'Invite/Registration Issue',
    checks: ['invite_code_valid', 'user_exists'],
  },
  {
    patterns: [/slow|timeout|loading|takes\s+forever|hang|freeze|crash/i],
    category: 'performance',
    quickDiagnosis: 'Performance Issue',
    checks: ['db_connection', 'recent_errors'],
  },
  {
    patterns: [/assessment|onboarding|start\s+chatting|name\s+generator/i],
    category: 'onboarding',
    quickDiagnosis: 'Onboarding/Assessment Issue',
    checks: ['assessment_status', 'profile_status'],
  },
];

// ============================================================
// SUPPORT AUTH (Separate from main auth)
// ============================================================

/** POST /api/support/login */
export async function handleSupportLogin(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return err('Email and password required', 400);

    const db = await getDb();
    const user = await db.collection('support_agents').findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.active) return err('Invalid credentials', 401);

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return err('Invalid credentials', 401);

    const token = generateToken(user.id);
    
    // Update last login
    await db.collection('support_agents').updateOne({ id: user.id }, { $set: { last_login: new Date() } });

    return ok({ token, agent: { id: user.id, name: user.name, email: user.email, role: 'support' } });
  } catch (error) {
    console.error('[Support Login] Error:', error);
    return err('Login failed', 500);
  }
}

/** Authenticate support agent from token */
async function authenticateSupport(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    const decoded = verifyToken(token);
    if (!decoded?.userId) return null;

    const db = await getDb();

    // Check if it's a support agent
    const supportAgent = await db.collection('support_agents').findOne({ id: decoded.userId, active: true });
    if (supportAgent) {
      return { id: supportAgent.id, name: supportAgent.name, email: supportAgent.email, role: 'support' };
    }

    // Also allow admin/superadmin users
    const user = await db.collection('users').findOne({ id: decoded.userId });
    if (user && ['admin', 'superadmin'].includes(user.role)) {
      return { id: user.id, name: user.name || user.display_name, email: user.email, role: user.role };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// SUPPORT AGENT MANAGEMENT (Superadmin only)
// ============================================================

/** POST /api/admin/support-agents — Create a support agent */
export async function handleCreateSupportAgent(request) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Superadmin only', 403);

  const { name, email, password } = await request.json();
  if (!name || !email || !password) return err('Name, email, and password required', 400);

  const db = await getDb();
  const existing = await db.collection('support_agents').findOne({ email: email.toLowerCase().trim() });
  if (existing) return err('Agent with this email already exists', 409);

  const agent = {
    id: uuidv4(),
    name,
    email: email.toLowerCase().trim(),
    password_hash: await hashPassword(password),
    active: true,
    created_at: new Date(),
    last_login: null,
  };

  await db.collection('support_agents').insertOne(agent);
  console.log(`[Support] Created agent: ${agent.name} (${agent.email})`);
  return ok({ agent: { id: agent.id, name: agent.name, email: agent.email, active: agent.active } });
}

/** GET /api/admin/support-agents — List support agents */
export async function handleGetSupportAgents(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return err('Forbidden', 403);

  const db = await getDb();
  const agents = await db.collection('support_agents').find({}).project({ password_hash: 0 }).toArray();
  return ok({ agents });
}

// ============================================================
// TICKET CRUD
// ============================================================

/** GET /api/support/tickets — List tickets */
export async function handleGetTickets(request) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = await getDb();
  const query = {};
  if (status) query.status = status;

  const tickets = await db.collection('support_tickets')
    .find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  return ok({ tickets });
}

/** GET /api/support/tickets/:id — Get single ticket with full details */
export async function handleGetTicket(request, ticketId) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  const db = await getDb();
  const ticket = await db.collection('support_tickets').findOne({ id: ticketId });
  if (!ticket) return err('Ticket not found', 404);

  return ok({ ticket });
}

/** POST /api/support/tickets — Create ticket (from pasted email or support chat) */
export async function handleCreateTicket(request) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  const { user_email, user_name, subject, description, source } = await request.json();
  if (!description) return err('Description is required', 400);

  const db = await getDb();

  // Try to find the user in our DB
  let userId = null;
  let userData = null;
  if (user_email) {
    const user = await db.collection('users').findOne({ email: user_email.toLowerCase().trim() });
    if (user) {
      userId = user.id;
      userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accepted: user.accepted,
        created_at: user.created_at,
      };
    }
  }

  const ticket = {
    id: uuidv4(),
    user_email: user_email || null,
    user_name: user_name || userData?.name || null,
    user_id: userId,
    user_data: userData,
    subject: subject || description.substring(0, 100),
    description,
    source: source || 'pasted_email', // 'pasted_email', 'support_chat', 'auto_detected'
    status: 'new',
    category: null,
    diagnosis: null,
    suggested_fix: null,
    fix_type: null,
    fix_actions: null,
    admin_notes: null,
    agent_id: agent.id,
    agent_name: agent.name || agent.email,
    notes: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('support_tickets').insertOne(ticket);
  console.log(`[Support] Ticket created: ${ticket.id} by ${agent.name || agent.email}`);

  return ok({ ticket });
}

/** POST /api/support/tickets/:id/diagnose — AI diagnoses the ticket */
export async function handleDiagnoseTicket(request, ticketId) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  const db = await getDb();
  const ticket = await db.collection('support_tickets').findOne({ id: ticketId });
  if (!ticket) return err('Ticket not found', 404);

  // Update status to diagnosing
  await db.collection('support_tickets').updateOne({ id: ticketId }, { $set: { status: 'diagnosing', updated_at: new Date() } });

  try {
    const diagnosis = await runDiagnosis(db, ticket);
    
    await db.collection('support_tickets').updateOne({ id: ticketId }, {
      $set: {
        status: diagnosis.fix_type === FIX_TYPES.CODE_FIX ? 'needs_development' : 'diagnosed',
        category: diagnosis.category,
        diagnosis: diagnosis.summary,
        suggested_fix: diagnosis.suggested_fix,
        fix_type: diagnosis.fix_type,
        fix_actions: diagnosis.fix_actions || null,
        db_findings: diagnosis.db_findings || null,
        user_response: diagnosis.user_response || null,
        severity: diagnosis.severity || 'medium',
        root_cause: diagnosis.root_cause || null,
        emergent_prompt: diagnosis.emergent_prompt || null,
        updated_at: new Date(),
      }
    });

    const updatedTicket = await db.collection('support_tickets').findOne({ id: ticketId });
    return ok({ ticket: updatedTicket });
  } catch (error) {
    console.error('[Support Diagnosis] Error:', error);
    await db.collection('support_tickets').updateOne({ id: ticketId }, { 
      $set: { status: 'new', diagnosis: `Diagnosis failed: ${error.message}`, updated_at: new Date() } 
    });
    return err('Diagnosis failed: ' + error.message, 500);
  }
}

/** POST /api/support/tickets/:id/approve-fix — Superadmin approves a fix */
export async function handleApproveTicketFix(request, ticketId) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Superadmin only', 403);

  const db = await getDb();
  const ticket = await db.collection('support_tickets').findOne({ id: ticketId });
  if (!ticket) return err('Ticket not found', 404);
  if (!ticket.fix_actions || ticket.fix_type !== FIX_TYPES.DATA_FIX) {
    return err('No auto-fixable actions for this ticket', 400);
  }

  // Execute the fix actions
  const results = [];
  for (const action of ticket.fix_actions) {
    try {
      const result = await executeFixAction(db, action);
      results.push({ action: action.description, success: true, result });
    } catch (e) {
      results.push({ action: action.description, success: false, error: e.message });
    }
  }

  const allSuccess = results.every(r => r.success);
  await db.collection('support_tickets').updateOne({ id: ticketId }, {
    $set: {
      status: allSuccess ? 'fix_applied' : 'diagnosed',
      fix_results: results,
      approved_by: user.id,
      approved_at: new Date(),
      updated_at: new Date(),
    }
  });

  const updatedTicket = await db.collection('support_tickets').findOne({ id: ticketId });
  return ok({ ticket: updatedTicket, results });
}

/** PATCH /api/support/tickets/:id — Update ticket (add notes, change status) */
export async function handleUpdateTicket(request, ticketId) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  const body = await request.json();
  const db = await getDb();
  const ticket = await db.collection('support_tickets').findOne({ id: ticketId });
  if (!ticket) return err('Ticket not found', 404);

  const updates = { updated_at: new Date() };
  
  if (body.status && TICKET_STATUSES.includes(body.status)) {
    // Only superadmin can set fix_approved
    if (body.status === 'fix_approved' && agent.role !== 'superadmin') {
      return err('Only superadmin can approve fixes', 403);
    }
    updates.status = body.status;
  }
  
  if (body.note) {
    updates.$push = { notes: { text: body.note, author: agent.name || agent.email, author_id: agent.id, created_at: new Date() } };
  }

  if (body.admin_notes !== undefined && ['admin', 'superadmin'].includes(agent.role)) {
    updates.admin_notes = body.admin_notes;
  }

  const { $push, ...setUpdates } = updates;
  const updateOp = { $set: setUpdates };
  if ($push) updateOp.$push = $push;

  await db.collection('support_tickets').updateOne({ id: ticketId }, updateOp);
  const updatedTicket = await db.collection('support_tickets').findOne({ id: ticketId });
  return ok({ ticket: updatedTicket });
}

// ============================================================
// AI DIAGNOSIS ENGINE
// ============================================================

async function runDiagnosis(db, ticket) {
  const description = `${ticket.subject || ''} ${ticket.description}`.toLowerCase();
  
  // Step 1: Pattern matching for quick category
  let matchedPattern = null;
  for (const pattern of KNOWN_PATTERNS) {
    if (pattern.patterns.some(p => p.test(description))) {
      matchedPattern = pattern;
      break;
    }
  }

  // Step 2: DB lookup if we have user info
  const dbFindings = {};
  if (ticket.user_id || ticket.user_email) {
    const userQuery = ticket.user_id ? { id: ticket.user_id } : { email: ticket.user_email.toLowerCase().trim() };
    
    const user = await db.collection('users').findOne(userQuery);
    if (user) {
      dbFindings.user = {
        exists: true,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accepted: user.accepted,
        created_at: user.created_at,
      };

      // Check profile
      const profile = await db.collection('profiles').findOne({ user_id: user.id });
      dbFindings.profile = profile ? {
        assessment_complete: profile.assessment_complete,
        assistant_name: profile.assistant_name,
        onboarding_complete: profile.onboarding_completed,
      } : { exists: false };

      // Check recent messages
      const msgCount = await db.collection('messages').countDocuments({ user_id: user.id });
      const recentMsgs = await db.collection('messages').find({ user_id: user.id }).sort({ created_at: -1 }).limit(5).project({ content: 1, role: 1, created_at: 1, content_type: 1 }).toArray();
      dbFindings.messages = { total: msgCount, recent: recentMsgs.length };

      // Check video jobs
      if (matchedPattern?.category === 'media_video' || /video/i.test(description)) {
        const videoJobs = await db.collection('video_jobs').find({ user_id: user.id }).sort({ created_at: -1 }).limit(5).toArray();
        dbFindings.video_jobs = videoJobs.map(j => ({
          id: j.id, status: j.status, model: j.model, created_at: j.created_at, error: j.error,
        }));
      }

      // Check assessment if relevant
      if (matchedPattern?.category === 'onboarding') {
        const answers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
        dbFindings.assessment = answers ? {
          layer1_complete: answers.layer1_complete,
          layer2_complete: answers.layer2_complete,
          answered_count: Object.keys(answers.layer1_answers || {}).length + Object.keys(answers.layer2_answers || {}).length,
        } : { exists: false };
      }

      // Check invite status if relevant
      if (matchedPattern?.category === 'invite') {
        dbFindings.invite = {
          invite_code: user.invite_code,
          invites_remaining: user.invites_remaining,
        };
      }
    } else {
      dbFindings.user = { exists: false, searched_email: ticket.user_email };
    }
  }

  // Step 3: AI-powered diagnosis using GPT
  const diagnosisPrompt = buildDiagnosisPrompt(ticket, matchedPattern, dbFindings);
  
  let aiDiagnosis;
  try {
    const provider = getProvider('openai');
    // Use the internal OpenAI client directly for JSON mode support
    const response = await provider.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are a technical support AI for the SoulPrint Engine app. Analyze the support ticket and provide a structured diagnosis. Be specific and actionable. Format your response as JSON with these fields:
{
  "category": "auth|media_video|media_image|data_loss|invite|performance|onboarding|billing|other",
  "summary": "Clear 2-3 sentence diagnosis of what's wrong",
  "root_cause": "What caused this issue",
  "suggested_fix": "What should be done to fix it. ALWAYS start with 'Conversation ID: <id>' on the first line. For CODE fixes, provide a DETAILED description that can be directly pasted into the Emergent development agent, including: the conversation_id, specific file paths to modify, what code to change, and any relevant IDs (user_id, conversation_id, etc.)",
  "fix_type": "data_fix|code_fix|user_action|no_fix",
  "fix_actions": [{"type": "db_update|db_delete|api_call", "collection": "...", "query": {...}, "update": {...}, "description": "Human-readable description"}],
  "severity": "critical|high|medium|low",
  "user_response": "Draft response to send to the user explaining the fix",
  "emergent_prompt": "If fix_type is code_fix, provide a complete prompt that can be pasted directly into Emergent to fix this issue. Include ALL specifics: user_id, conversation_id, email, file paths, exact error, and step-by-step instructions. If not code_fix, set to null."
}
Only include fix_actions for data_fix type. For code_fix, the emergent_prompt must be a self-contained instruction that a developer agent can execute without needing additional context.` },
        { role: 'user', content: diagnosisPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content || '';
    aiDiagnosis = JSON.parse(content);
  } catch (e) {
    console.error('[Diagnosis AI] Error:', e.message);
    // Fallback to pattern-based diagnosis
    aiDiagnosis = {
      category: matchedPattern?.category || 'other',
      summary: matchedPattern?.quickDiagnosis || 'Unable to auto-diagnose. Manual review required.',
      root_cause: 'AI diagnosis unavailable — review DB findings manually.',
      suggested_fix: 'Check the DB findings section for clues.',
      fix_type: FIX_TYPES.CODE_FIX,
      fix_actions: [],
      severity: 'medium',
      user_response: 'We are investigating your issue and will get back to you shortly.',
    };
  }

  return {
    category: aiDiagnosis.category,
    summary: aiDiagnosis.summary,
    root_cause: aiDiagnosis.root_cause,
    suggested_fix: aiDiagnosis.suggested_fix,
    fix_type: aiDiagnosis.fix_type,
    fix_actions: aiDiagnosis.fix_actions || [],
    severity: aiDiagnosis.severity,
    user_response: aiDiagnosis.user_response,
    db_findings: dbFindings,
    pattern_match: matchedPattern?.category || null,
  };
}

function buildDiagnosisPrompt(ticket, pattern, dbFindings) {
  let prompt = `## Support Ticket\n`;
  prompt += `**Subject:** ${ticket.subject || 'N/A'}\n`;
  prompt += `**Description:** ${ticket.description}\n`;
  prompt += `**User Email:** ${ticket.user_email || 'Not provided'}\n`;
  prompt += `**User ID:** ${ticket.user_id || 'Not available'}\n`;
  prompt += `**Conversation ID:** ${ticket.conversation_id || 'Not available'}\n`;
  prompt += `**Source:** ${ticket.source}\n`;
  prompt += `**Ticket ID:** ${ticket.id}\n\n`;

  if (ticket.bot_conversation_summary) {
    prompt += `## Ace Bot Conversation (before escalation)\n${ticket.bot_conversation_summary}\n\n`;
  }

  if (pattern) {
    prompt += `## Pattern Match\nCategory: ${pattern.category}\nQuick Diagnosis: ${pattern.quickDiagnosis}\n\n`;
  }

  if (Object.keys(dbFindings).length > 0) {
    prompt += `## Database Findings\n`;
    prompt += JSON.stringify(dbFindings, null, 2);
    prompt += `\n\n`;
  }

  prompt += `## Known Data-Level Fixes Available\n`;
  prompt += `- Reset user password (collection: users, update password_hash)\n`;
  prompt += `- Set assessment_complete=true (collection: profiles)\n`;
  prompt += `- Set accepted=true for user (collection: users)\n`;
  prompt += `- Clear stuck video jobs (collection: video_jobs, set status='failed')\n`;
  prompt += `- Grant invite codes (collection: users, update invites_remaining)\n`;
  prompt += `- Reset onboarding (collection: profiles, set onboarding_completed/assessment_complete)\n\n`;

  prompt += `IMPORTANT: In your diagnosis, always reference the specific user_id (${ticket.user_id || 'unknown'}), conversation_id (${ticket.conversation_id || 'N/A'}), and user email (${ticket.user_email || 'N/A'}) in your suggested_fix and emergent_prompt fields so the fix can be applied precisely. The suggested_fix field MUST begin with "Conversation ID: ${ticket.conversation_id || 'N/A'}" on the first line, followed by the fix details.\n`;
  prompt += `Provide a structured diagnosis with specific fix actions if this is a data-level issue.`;
  return prompt;
}

// ============================================================
// FIX EXECUTION ENGINE
// ============================================================

async function executeFixAction(db, action) {
  console.log(`[Support Fix] Executing: ${action.description}`);

  switch (action.type) {
    case 'db_update': {
      if (!action.collection || !action.query || !action.update) {
        throw new Error('Invalid db_update action: missing collection, query, or update');
      }
      // Safety: only allow updates to specific collections
      const allowedCollections = ['users', 'profiles', 'video_jobs', 'layered_assessment_answers', 'communication_profiles'];
      if (!allowedCollections.includes(action.collection)) {
        throw new Error(`Collection "${action.collection}" is not allowed for auto-fixes`);
      }
      const result = await db.collection(action.collection).updateOne(action.query, { $set: action.update });
      return { matched: result.matchedCount, modified: result.modifiedCount };
    }

    case 'db_delete': {
      // Very restricted — only allow deleting specific things
      const deletableCollections = ['video_jobs', 'temp_attachments'];
      if (!deletableCollections.includes(action.collection)) {
        throw new Error(`Deletion from "${action.collection}" is not allowed`);
      }
      const result = await db.collection(action.collection).deleteOne(action.query);
      return { deleted: result.deletedCount };
    }

    default:
      throw new Error(`Unknown fix action type: ${action.type}`);
  }
}


/**
 * POST /api/support/tickets/:id/respond
 * Support person sends a response message to the user who submitted the ticket.
 * Creates an in-app notification and optionally injects into their conversation.
 */
export async function handleRespondToTicketUser(request, ticketId) {
  const agent = await authenticateSupport(request);
  if (!agent) return err('Unauthorized', 401);

  try {
    const body = await request.json();
    const { message, markResolved = false } = body;

    if (!message) return err('Message is required', 400);

    const db = await getDb();
    const ticket = await db.collection('support_tickets').findOne({ id: ticketId });
    if (!ticket) return err('Ticket not found', 404);

    const results = { notification: false, conversation_message: false };

    // 1. Create an in-app notification for the user
    const userId = ticket.user_id;
    const userEmail = ticket.user_email;

    if (userId) {
      try {
        await db.collection('notifications').insertOne({
          id: uuidv4(),
          user_id: userId,
          type: 'support_response',
          title: `Re: ${ticket.subject}`,
          message: message,
          ticket_id: ticketId,
          read: false,
          created_at: new Date(),
        });
        results.notification = true;
      } catch (e) {
        console.error('[SupportRespond] Notification error:', e.message);
      }
    } else if (userEmail) {
      // If no user_id, try to find the user by email
      try {
        const user = await db.collection('users').findOne({ email: userEmail });
        if (user) {
          await db.collection('notifications').insertOne({
            id: uuidv4(),
            user_id: user.id,
            type: 'support_response',
            title: `Re: ${ticket.subject}`,
            message: message,
            ticket_id: ticketId,
            read: false,
            created_at: new Date(),
          });
          results.notification = true;
        }
      } catch (e) {
        console.error('[SupportRespond] User lookup error:', e.message);
      }
    }

    // 2. If ticket has a conversation_id, inject a system message into that conversation
    if (ticket.conversation_id) {
      try {
        await db.collection('messages').insertOne({
          id: uuidv4(),
          conversation_id: ticket.conversation_id,
          user_id: userId || ticket.user_id,
          role: 'assistant',
          content: `📩 **Support Team Response** (Ticket #${ticketId.slice(0, 8)})\n\n${message}`,
          model: 'support-team',
          created_at: new Date(),
        });
        results.conversation_message = true;
      } catch (e) {
        console.error('[SupportRespond] Conversation message error:', e.message);
      }
    }

    // 3. Log the response on the ticket
    const updateFields = {
      updated_at: new Date(),
    };

    if (markResolved) {
      updateFields.status = 'resolved';
      updateFields.resolved_at = new Date();
      updateFields.resolved_by = agent.email || agent.name || agent.id;
    }

    await db.collection('support_tickets').updateOne(
      { id: ticketId },
      {
        $set: updateFields,
        $push: {
          responses: {
            agent_id: agent.id,
            agent_name: agent.name || agent.email,
            message: message,
            mark_resolved: markResolved,
            channels: results,
            created_at: new Date(),
          },
        },
      }
    );

    return ok({
      success: true,
      results,
      message: `Response sent${results.notification ? ' (in-app notification)' : ''}${results.conversation_message ? ' + conversation message' : ''}${markResolved ? ' — Ticket marked resolved' : ''}`,
    });
  } catch (e) {
    console.error('[SupportRespond] Error:', e);
    return err('Failed to send response', 500);
  }
}
