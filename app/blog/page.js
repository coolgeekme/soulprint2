'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, Tag, ChevronRight, MessageSquare } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function BlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('sp_token');
    setIsLoggedIn(!!token);
    fetchPosts();
  }, [selectedCategory, selectedTag]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = '/api/blog/posts?limit=50';
      if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data.posts || []);
      setCategories(data.categories || []);
      setTags(data.tags || []);
    } catch (e) {
      console.error('Failed to fetch posts:', e);
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <SoulPrintLogo size={32} />
              <span className="font-semibold">SoulPrint</span>
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Blog</span>
          </div>
          <Link 
            href="/auth" 
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-orange-500/10 to-transparent py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold mb-4">Blog & News</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Stay updated with the latest news, insights, and tips about AI companions and personal productivity.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Posts Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white/5 rounded-2xl h-80 animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No posts yet. Check back soon!</p>
                <Link href="/" className="text-orange-500 hover:text-orange-400">
                  ← Back to home
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {posts.map(post => (
                  <Link 
                    key={post.id} 
                    href={`/blog/${post.slug}`}
                    className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all duration-300"
                  >
                    {/* Featured Image */}
                    {post.featured_image ? (
                      <div className="aspect-video bg-gray-900 overflow-hidden">
                        <img 
                          src={post.featured_image} 
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                        <SoulPrintLogo size={48} />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="p-6">
                      {/* Category */}
                      {post.category && (
                        <span className="text-xs text-orange-500 font-medium uppercase tracking-wider">
                          {post.category}
                        </span>
                      )}
                      
                      {/* Title */}
                      <h2 className="text-xl font-semibold text-white mt-2 mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      
                      {/* Excerpt */}
                      <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>
                      
                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {post.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(post.published_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 space-y-8">
            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Categories</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !selectedCategory ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All Posts
                  </button>
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCategory === cat ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        selectedTag === tag 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Try SoulPrint</h3>
              <p className="text-gray-400 text-sm mb-4">
                Experience AI that truly understands you.
              </p>
              <Link 
                href="/auth"
                className="block w-full py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium text-center transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
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
