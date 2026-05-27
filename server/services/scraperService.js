/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Target,
    Plus,
    RefreshCw,
    Trash2,
    TrendingUp,
    TrendingDown,
    Minus,
    ExternalLink,
    Clock,
    Loader2,
    Search,
    Globe,
    Eye,
    EyeOff,
    Filter,
    ArrowUpDown,
} from "lucide-react";

import { useApp } from "../context/AppContent";

interface KeywordItem {
    _id: string;
    keyword: string;
    url: string;
    domain: string;
    currentPosition: number | null;
    currentPage: number | null;
    bestPosition: number | null;
    positionChange: number;
    active: boolean;
    status: string;
    competitors: {
        position: number;
        url: string;
        domain: string;
        title: string;
        snippet: string;
    }[];
    createdAt?: string;
    updatedAt?: string;
}

export default function RankTracker() {
    const { api } = useApp();

    const [keywords, setKeywords] = useState<KeywordItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");

    // MODAL STATE
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newKeyword, setNewKeyword] = useState("");
    const [newUrl, setNewUrl] = useState("");
    const [adding, setAdding] = useState(false);

    // FETCH KEYWORDS
    const fetchKeywords = async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/rank/list");
            if (res.data.success) {
                setKeywords(res.data.keywords || []);
            }
        } catch (err) {
            console.error("Failed to fetch keywords:", err);
        } finally {
            setLoading(false);
        }
    };

    // ADD KEYWORD
    const handleAddKeyword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim() || !newUrl.trim()) return;

        try {
            setAdding(true);
            const res = await api.post("/api/rank/add", {
                keyword: newKeyword.trim(),
                url: newUrl.trim(),
            });

            if (res.data.success) {
                setKeywords((prev) => [res.data.tracking, ...prev]);
                setNewKeyword("");
                setNewUrl("");
                setIsModalOpen(false);
            }
        } catch (error: any) {
            console.error("Failed to add keyword:", error);
            alert(error.response?.data?.message || "Failed to add keyword");
        } finally {
            setAdding(false);
        }
    };

    // REFRESH
    const handleRefresh = async (id: string) => {
        try {
            setRefreshing(id);
            setKeywords((prev) =>
                prev.map((k) => k._id === id ? { ...k, status: "checking" } : k)
            );

            await api.post(`/api/rank/${id}/refresh`);

            const pollInterval = setInterval(async () => {
                try {
                    const check = await api.get(`/api/rank/${id}`);
                    if (check.data.tracking.status !== "checking") {
                        clearInterval(pollInterval);
                        setKeywords((prev) =>
                            prev.map((k) => k._id === id ? check.data.tracking : k)
                        );
                        setRefreshing(null);
                    }
                } catch (error) {
                    console.error(error);
                    clearInterval(pollInterval);
                    setRefreshing(null);
                }
            }, 3000);
        } catch (error) {
            console.error("Refresh failed:", error);
            setRefreshing(null);
        }
    };

    // DELETE
    const handleDelete = async (id: string) => {
        const confirmDelete = window.confirm("Delete this keyword tracking?");
        if (!confirmDelete) return;

        try {
            setDeleting(id);
            await api.delete(`/api/rank/${id}`);
            setKeywords((prev) => prev.filter((k) => k._id !== id));
        } catch (error) {
            console.error("Delete failed:", error);
        } finally {
            setDeleting(null);
        }
    };

    // TOGGLE
    const handleToggle = async (id: string) => {
        try {
            const res = await api.put(`/api/rank/${id}/toggle`);
            if (res.data.success) {
                setKeywords((prev) =>
                    prev.map((k) =>
                        k._id === id ? { ...k, active: res.data.tracking.active } : k
                    )
                );
            }
        } catch (error) {
            console.error("Toggle failed:", error);
        }
    };

    // POSITION BADGE
    const getPositionBadge = (pos: number | null) => {
        if (pos === null) return { text: "Not Ranked", class: "text-muted-foreground bg-muted/50" };
        if (pos <= 3) return { text: `#${pos}`, class: "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30" };
        if (pos <= 10) return { text: `#${pos}`, class: "text-primary bg-primary/15 border border-primary/30" };
        if (pos <= 20) return { text: `#${pos}`, class: "text-accent bg-accent/15 border border-accent/30" };
        return { text: `#${pos}`, class: "text-danger bg-danger/15 border border-danger/30" };
    };

    // CHANGE INDICATOR
    const getChangeIndicator = (change: number) => {
        if (change > 0) return { icon: <TrendingUp size={14} />, text: `+${change}`, class: "text-emerald-500" };
        if (change < 0) return { icon: <TrendingDown size={14} />, text: `${change}`, class: "text-danger" };
        return { icon: <Minus size={14} />, text: "0", class: "text-muted-foreground" };
    };

    // FILTER + SORT
    let processedData = [...keywords];

    if (searchQuery) {
        processedData = processedData.filter(
            (k) =>
                k.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
                k.domain.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    if (statusFilter === "active") processedData = processedData.filter((k) => k.active);
    else if (statusFilter === "paused") processedData = processedData.filter((k) => !k.active);

    processedData.sort((a, b) => {
        if (sortBy === "newest") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        if (sortBy === "rank_asc") return (a.currentPosition || 999) - (b.currentPosition || 999);
        if (sortBy === "rank_desc") return (b.currentPosition || 0) - (a.currentPosition || 0);
        if (sortBy === "change") return (b.positionChange || 0) - (a.positionChange || 0);
        return 0;
    });

    useEffect(() => {
        fetchKeywords();
    }, []);

    return (
        <div className="min-h-screen pt-16 md:pt-24 bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-medium text-foreground">
                            <span className="gradient-text">Rank Tracker</span>
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Track your keyword rankings on Google — updated daily.
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2 self-start cursor-pointer"
                        style={{ color: "var(--background)" }}
                    >
                        <Plus size={18} />
                        Track Keyword
                    </button>
                </div>

                {/* FILTERS */}
                <div className="mb-6 flex flex-col md:flex-row gap-3">
                    <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 flex-1">
                        <Search size={18} className="text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search keywords or domains..."
                            className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none flex-1"
                        />
                    </div>

                    <div className="flex gap-3">
                        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <Filter size={16} className="text-muted-foreground" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent text-sm text-foreground outline-none appearance-none pr-4 cursor-pointer"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                            </select>
                        </div>

                        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <ArrowUpDown size={16} className="text-muted-foreground" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent text-sm text-foreground outline-none appearance-none pr-4 cursor-pointer"
                            >
                                <option value="newest">Newest First</option>
                                <option value="rank_asc">Highest Ranked</option>
                                <option value="rank_desc">Lowest Ranked</option>
                                <option value="change">Biggest Gain</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* CONTENT */}
                {loading ? (
                    <div className="flex items-center justify-center py-32">
                        <Loader2 className="animate-spin" />
                    </div>
                ) : processedData.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center">
                        <Target size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No keywords tracked yet</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Add your first keyword and URL to start tracking your Google rankings.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {processedData.map((kw) => {
                            const posBadge = getPositionBadge(kw.currentPosition);
                            const change = getChangeIndicator(kw.positionChange);

                            return (
                                <div
                                    key={kw._id}
                                    className={`glass rounded-xl p-5 hover:bg-muted/50 transition-all ${!kw.active ? "opacity-50" : ""}`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* LEFT */}
                                        <div className="flex items-center gap-4 lg:w-32 shrink-0">
                                            {kw.status === "checking" ? (
                                                <div className="w-16 h-16 rounded-xl glass flex items-center justify-center">
                                                    <Loader2 size={24} className="animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-lg font-bold ${posBadge.class}`}>
                                                    {kw.currentPosition ? `#${kw.currentPosition}` : "—"}
                                                </div>
                                            )}

                                            {kw.status === "completed" && kw.currentPosition && (
                                                <div className="text-center mt-1">
                                                    <div className={`flex items-center justify-center gap-1 text-sm font-medium ${change.class}`}>
                                                        {change.icon}
                                                        {change.text}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">change</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* MIDDLE */}
                                        <div className="flex-1 min-w-0">
                                            <Link
                                                to={`/rank/${kw._id}`}
                                                className="text-base font-semibold text-foreground hover:text-primary transition-colors block truncate"
                                            >
                                                "{kw.keyword}"
                                            </Link>

                                            <div className="flex items-center gap-2 mt-1">
                                                <Globe size={12} className="text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground truncate">{kw.domain}</span>
                                                {kw.currentPage && (
                                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        Page {kw.currentPage}
                                                    </span>
                                                )}
                                            </div>

                                            {kw.updatedAt && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                    <Clock size={10} />
                                                    Last checked: {new Date(kw.updatedAt).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* STATS */}
                                        {kw.status === "completed" && (
                                            <div className="hidden md:flex items-center gap-5">
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-primary">{kw.bestPosition || "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">Best</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-accent">{kw.competitors?.length || 0}</p>
                                                    <p className="text-[10px] text-muted-foreground">Competitors</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* ACTIONS */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Link
                                                to={`/rank/${kw._id}`}
                                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                                            >
                                                <ExternalLink size={16} />
                                            </Link>

                                            <button
                                                onClick={() => handleRefresh(kw._id)}
                                                disabled={refreshing === kw._id || kw.status === "checking"}
                                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all disabled:opacity-30"
                                            >
                                                <RefreshCw size={16} className={refreshing === kw._id ? "animate-spin" : ""} />
                                            </button>

                                            <button
                                                onClick={() => handleToggle(kw._id)}
                                                className={`p-2 rounded-lg hover:bg-muted transition-all ${kw.active ? "text-success" : "text-muted-foreground"}`}
                                            >
                                                {kw.active ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>

                                            <button
                                                onClick={() => handleDelete(kw._id)}
                                                disabled={deleting === kw._id}
                                                className="p-2 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all"
                                            >
                                                {deleting === kw._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ✅ MODAL */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
                >
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 relative shadow-xl mx-4">
                        <h2 className="text-xl font-semibold text-foreground mb-4">Track New Keyword</h2>

                        <form onSubmit={handleAddKeyword} className="space-y-4">
                            <div>
                                <label className="block text-sm text-foreground mb-1.5 font-medium">Keyword</label>
                                <div className="relative">
                                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        required
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        placeholder="e.g., best seo tool"
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-foreground mb-1.5 font-medium">Website URL</label>
                                <div className="relative">
                                    <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        required
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                        placeholder="e.g., example.com"
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setNewKeyword(""); setNewUrl(""); }}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="bg-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
                                    style={{ color: "var(--background)" }}
                                >
                                    {adding ? (
                                        <><Loader2 size={16} className="animate-spin" /> Tracking...</>
                                    ) : (
                                        "Start Tracking"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}