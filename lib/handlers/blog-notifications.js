/**
 * Blog and Notifications handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';

// Helper to generate URL-friendly slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

// Get all published blog posts (public)
async function handleGetBlogPosts(request) {
  const db = await getDb();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  
  const query = { status: 'published' };
  if (category) query.category = category;
  if (tag) query.tags = tag;
  
  const posts = await db.collection('blog_posts')
    .find(query)
    .sort({ published_at: -1 })
    .limit(limit)
    .toArray();
  
  const allPosts = await db.collection('blog_posts')
    .find({ status: 'published' })
    .project({ category: 1, tags: 1 })
    .toArray();
  
  const categories = [...new Set(allPosts.map(p => p.category).filter(Boolean))];
  const tags = [...new Set(allPosts.flatMap(p => p.tags || []))];
  
  return ok({ posts, categories, tags });
}

// Get single blog post by slug (public)
async function handleGetBlogPost(request, slug) {
  const db = await getDb();
  
  const post = await db.collection('blog_posts').findOne({ 
    slug, 
    status: 'published' 
  });
  
  if (!post) return err('Post not found', 404);
  
  const relatedPosts = await db.collection('blog_posts')
    .find({ 
      status: 'published', 
      category: post.category, 
      id: { $ne: post.id } 
    })
    .sort({ published_at: -1 })
    .limit(3)
    .toArray();
  
  return ok({ post, relatedPosts });
}

// Notifications
async function handleGetNotifications(request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  
  const notifications = await db.collection('notifications').find({
    $or: [
      { user_id: user.id },
      { user_email: user.email?.toLowerCase() }
    ],
    read: false,
  }).sort({ created_at: -1 }).limit(20).toArray();

  const cleaned = notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    conversation_id: n.conversation_id,
    created_at: n.created_at,
  }));

  return NextResponse.json({ notifications: cleaned });
}

async function handleMarkNotificationsRead(request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { notification_ids } = body;

  const db = await getDb();

  if (notification_ids === 'all') {
    await db.collection('notifications').updateMany(
      { $or: [{ user_id: user.id }, { user_email: user.email?.toLowerCase() }] },
      { $set: { read: true } }
    );
  } else if (Array.isArray(notification_ids)) {
    await db.collection('notifications').updateMany(
      { id: { $in: notification_ids } },
      { $set: { read: true } }
    );
  }

  return NextResponse.json({ success: true });
}

export {
  generateSlug,
  handleGetBlogPosts,
  handleGetBlogPost,
  handleGetNotifications,
  handleMarkNotificationsRead,
};
