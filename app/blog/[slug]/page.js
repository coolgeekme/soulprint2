'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, Tag, Share2, Twitter, Facebook, Linkedin, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('sp_token');
    setIsLoggedIn(!!token);
    
    if (params.slug) {
      fetchPost(params.slug);
    }
  }, [params.slug]);

  const fetchPost = async (slug) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/posts/${slug}`);
      const data = await res.json();
      
      if (data.error) {
        router.push('/blog');
        return;
      }
      
      setPost(data.post);
      setRelatedPosts(data.relatedPosts || []);
    } catch (e) {
      console.error('Failed to fetch post:', e);
      router.push('/blog');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = post?.title || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <SoulPrintLogo size={32} />
              <span className="font-semibold">SoulPrint</span>
            </Link>
            <span className="text-gray-600">/</span>
            <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link 
                href="/chat" 
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Back to Chat
              </Link>
            ) : (
              <Link 
                href="/auth" 
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to all posts
        </Link>

        {/* Category - Centered */}
        {post.category && (
          <div className="text-center mb-6">
            <span className="inline-block text-xs text-orange-500 font-medium uppercase tracking-wider bg-orange-500/10 px-3 py-1 rounded-full">
              {post.category}
            </span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight text-center">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-8 pb-8 border-b border-white/10">
          <span className="flex items-center gap-2">
            <User className="w-4 h-4" />
            {post.author}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(post.published_at)}
          </span>
          {post.tags?.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {post.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-white/10 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Featured Image */}
        {post.featured_image && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
            <img 
              src={post.featured_image} 
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-invert prose-lg prose-orange max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-3xl font-bold text-white mt-10 mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-2xl font-semibold text-white mt-8 mb-4">{children}</h2>,
              h3: ({ children }) => <h3 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h3>,
              p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-4">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">{children}</ol>,
              li: ({ children }) => <li className="text-gray-300">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-orange-500 pl-4 italic text-gray-400 my-6">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="bg-white/10 px-2 py-1 rounded text-orange-400 text-sm">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="bg-white/5 border border-white/10 rounded-lg p-4 overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-orange-500 hover:text-orange-400 underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                <img src={src} alt={alt} className="rounded-lg my-6 w-full" />
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Share */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share this post:
            </span>
            <a 
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a 
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a 
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <Link 
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="bg-white/5 border-t border-white/10 py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-white mb-8">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map(related => (
                <Link 
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="group bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-orange-500/50 transition-all"
                >
                  {related.featured_image ? (
                    <div className="aspect-video bg-gray-900 overflow-hidden">
                      <img 
                        src={related.featured_image} 
                        alt={related.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                      <SoulPrintLogo size={32} />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDate(related.published_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to try SoulPrint?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Experience AI that adapts to your unique communication style and truly understands you.
          </p>
          <Link 
            href="/auth"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <p className="text-gray-500 text-sm">© 2026 ArcheForge LLC. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-gray-500 text-sm hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="text-gray-500 text-sm hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
