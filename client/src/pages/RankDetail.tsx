/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft,
    Globe,
    TrendingUp,
    TrendingDown,
    Minus,
    RefreshCw,
    AlertCircle,
    ExternalLink,
    Trophy,
    Users,
    Calendar,
} from "lucide-react";

import { useApp } from "../context/AppContent";

interface RankHistoryEntry {
    date: string;
    position: number | null;
    page: number | null;
    title: string;
    snippet: string;
}

interface Competitor {
    position: number;
    url: string;
    domain: string;
    title: string;
    snippet: string;
}

interface TrackingData {
    _id: string;
    keyword: string;
    url: string;
    domain: string;
    currentPosition: number | null;
    currentPage: number | null;
    bestPosition: number | null;
    positionChange: number;
    rankHistory: RankHistoryEntry[];
    competitors: Competitor[];
    active: boolean;
    lastChecked: string | null;
    status: string;
    createdAt: string;
}

export default function RankDetail() {
    const { api } = useApp();

    const { id } = useParams();

    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    const chartRef = useRef<HTMLCanvasElement>(null);

    // FETCH TRACKING
    const fetchTracking = async () => {
        try {
            const res = await api.get(`/api/rank/${id}`);

            if (res.data.success) {
                setTracking(res.data.tracking);

                // Poll every 3 sec while checking
                if (res.data.tracking.status === "checking") {
                    setTimeout(fetchTracking, 3000);
                }
            } else {
                setTracking(null);
            }
        } catch (error) {
            console.error("Fetch tracking failed:", error);
            setTracking(null);
        } finally {
            setLoading(false);
        }
    };

    // REFRESH TRACKING
    const handleRefresh = async () => {
        if (!tracking) return;

        setRefreshing(true);

        try {
            await api.post(`/api/rank/${tracking._id}/refresh`);

            // Optimistic update
            setTracking((prev) =>
                prev
                    ? {
                          ...prev,
                          status: "checking",
                      }
                    : null
            );

            // Polling
            const pollInterval = setInterval(async () => {
                try {
                    const check = await api.get(`/api/rank/${tracking._id}`);

                    if (check.data.tracking.status !== "checking") {
                        clearInterval(pollInterval);

                        setTracking(check.data.tracking);
                        setRefreshing(false);
                    } else {
                        setTracking(check.data.tracking);
                    }
                } catch (error) {
                    console.error("Polling failed:", error);
                    clearInterval(pollInterval);
                    setRefreshing(false);
                }
            }, 3000);
        } catch (error) {
            console.error("Refresh failed:", error);
            setRefreshing(false);
        }
    };

    // DRAW CHART
    const drawChart = () => {
        const canvas = chartRef.current;

        if (!canvas || !tracking) return;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        const history = tracking.rankHistory
            .filter((h) => h.position !== null)
            .sort(
                (a, b) =>
                    new Date(a.date).getTime() -
                    new Date(b.date).getTime()
            );

        if (history.length === 0) return;

        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;

        const padding = {
            top: 30,
            right: 30,
            bottom: 50,
            left: 50,
        };

        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        const positions = history.map((h) => h.position!);

        const minPos = Math.max(1, Math.min(...positions) - 2);
        const maxPos = Math.max(...positions) + 2;

        const styles = getComputedStyle(document.documentElement);

        const borderColor =
            styles.getPropertyValue("--border").trim() ||
            "rgba(128,128,128,0.2)";

        const primaryColor =
            styles.getPropertyValue("--accent").trim() || "#3b82f6";

        const textColor =
            styles.getPropertyValue("--muted-foreground").trim() ||
            "rgba(128,128,128,0.5)";

        const bgColor =
            styles.getPropertyValue("--background").trim() || "#ffffff";

        // GRID
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;

        const gridLines = 5;

        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const posVal = Math.round(
                minPos + ((maxPos - minPos) / gridLines) * i
            );

            ctx.fillStyle = textColor;
            ctx.font = "11px Playfair Display";
            ctx.textAlign = "right";

            ctx.fillText(`#${posVal}`, padding.left - 8, y + 4);
        }

        // DATE LABELS
        ctx.fillStyle = textColor;
        ctx.font = "10px Playfair Display";
        ctx.textAlign = "center";

        const maxLabels = Math.min(history.length, 7);

        const labelStep = Math.max(
            1,
            Math.floor(history.length / maxLabels)
        );

        for (let i = 0; i < history.length; i += labelStep) {
            const x =
                padding.left +
                (chartW / Math.max(history.length - 1, 1)) * i;

            const date = new Date(history[i].date);

            ctx.fillText(
                `${date.getMonth() + 1}/${date.getDate()}`,
                x,
                h - padding.bottom + 20
            );
        }

        // LINE
        ctx.beginPath();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        history.forEach((entry, i) => {
            const x =
                padding.left +
                (chartW / Math.max(history.length - 1, 1)) * i;

            const yNorm =
                (entry.position! - minPos) / (maxPos - minPos);

            const y = padding.top + yNorm * chartH;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // GRADIENT
        const gradient = ctx.createLinearGradient(
            0,
            padding.top,
            0,
            h - padding.bottom
        );

        gradient.addColorStop(0, "rgba(59,130,246,0.15)");
        gradient.addColorStop(1, "rgba(59,130,246,0)");

        ctx.beginPath();

        history.forEach((entry, i) => {
            const x =
                padding.left +
                (chartW / Math.max(history.length - 1, 1)) * i;

            const yNorm =
                (entry.position! - minPos) / (maxPos - minPos);

            const y = padding.top + yNorm * chartH;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.lineTo(padding.left + chartW, h - padding.bottom);
        ctx.lineTo(padding.left, h - padding.bottom);

        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        // DOTS
        history.forEach((entry, i) => {
            const x =
                padding.left +
                (chartW / Math.max(history.length - 1, 1)) * i;

            const yNorm =
                (entry.position! - minPos) / (maxPos - minPos);

            const y = padding.top + yNorm * chartH;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = primaryColor;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = bgColor;
            ctx.fill();
        });

        // Y AXIS LABEL
        ctx.save();

        ctx.translate(12, h / 2);
        ctx.rotate(-Math.PI / 2);

        ctx.fillStyle = textColor;
        ctx.font = "11px Playfair Display";
        ctx.textAlign = "center";

        ctx.fillText("Position", 0, 0);

        ctx.restore();
    };

    const getChangeIndicator = (change: number) => {
        if (change > 0) {
            return {
                icon: <TrendingUp size={16} />,
                text: `+${change}`,
                class: "text-emerald-500",
            };
        }

        if (change < 0) {
            return {
                icon: <TrendingDown size={16} />,
                text: `${change}`,
                class: "text-danger",
            };
        }

        return {
            icon: <Minus size={16} />,
            text: "—",
            class: "text-muted-foreground",
        };
    };

    const getPositionColor = (pos: number | null) => {
        if (pos === null) return "text-muted-foreground";
        if (pos <= 3) return "text-emerald-500";
        if (pos <= 10) return "text-primary";
        if (pos <= 20) return "text-accent";

        return "text-danger";
    };

    useEffect(() => {
        fetchTracking();
    }, [id]);

    useEffect(() => {
        if (
            tracking &&
            tracking.rankHistory.length > 0 &&
            chartRef.current
        ) {
            drawChart();
        }
    }, [tracking, activeTab]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!tracking) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center glass-strong rounded-2xl p-10">
                    <AlertCircle
                        size={48}
                        className="mx-auto text-danger mb-4"
                    />

                    <h2 className="text-xl font-bold text-foreground mb-2">
                        Tracking Not Found
                    </h2>

                    <Link
                        to="/rank-tracker"
                        className="bg-primary px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground mt-4 inline-block"
                        style={{ color: "var(--background)" }}
                    >
                        Back to Rank Tracker
                    </Link>
                </div>
            </div>
        );
    }

    const change = getChangeIndicator(tracking.positionChange);

    const tabs = [
        { id: "overview", label: "Overview" },
        {
            id: "competitors",
            label: `Competitors (${tracking.competitors.length})`,
        },
        { id: "history", label: "History" },
    ];

    return (
        <div className="min-h-screen pt-16 md:pt-24 bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

                {/* BACK + HEADER */}
                <div className="mb-8">
                    <Link
                        to="/rank-tracker"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Rank Tracker
                    </Link>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-medium text-foreground">
                                "
                                <span className="gradient-text">
                                    {tracking.keyword}
                                </span>
                                "
                            </h1>

                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Globe size={14} />

                                <span>{tracking.domain}</span>

                                <a
                                    href={tracking.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                >
                                    Visit <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={
                                refreshing ||
                                tracking.status === "checking"
                            }
                            className="glass px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-muted/50 transition-all disabled:opacity-50 self-start text-foreground"
                        >
                            <RefreshCw
                                size={16}
                                className={refreshing ? "animate-spin" : ""}
                            />
                            Refresh Now
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                            style={activeTab === tab.id ? { color: "var(--background)" } : {}}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB CONTENT */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Current Position */}
                        <div className="glass-strong rounded-2xl p-6 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Current Position</p>
                            <p className={`text-5xl font-bold ${getPositionColor(tracking.currentPosition)}`}>
                                {tracking.currentPosition ? `#${tracking.currentPosition}` : "—"}
                            </p>
                            {tracking.currentPosition && (
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    {change.icon}
                                    <span className={`text-sm font-medium ${change.class}`}>
                                        {change.text}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Best Position */}
                        <div className="glass rounded-2xl p-6 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Best Position</p>
                            <p className="text-4xl font-bold text-primary">
                                {tracking.bestPosition ? `#${tracking.bestPosition}` : "—"}
                            </p>
                            <Trophy size={24} className="mx-auto mt-3 text-primary/60" />
                        </div>

                        {/* Current Page */}
                        <div className="glass rounded-2xl p-6 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Current Page</p>
                            <p className="text-4xl font-bold text-accent">
                                {tracking.currentPage ? tracking.currentPage : "—"}
                            </p>
                            <Globe size={24} className="mx-auto mt-3 text-accent/60" />
                        </div>
                    </div>
                )}

                {activeTab === "competitors" && (
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Users size={20} className="text-primary" />
                            Top Competitors
                        </h3>
                        {tracking.competitors.length > 0 ? (
                            <div className="space-y-3">
                                {tracking.competitors.map((comp) => (
                                    <div
                                        key={comp.position}
                                        className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                            #{comp.position}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground truncate">{comp.title}</p>
                                            <p className="text-sm text-muted-foreground truncate">{comp.domain}</p>
                                            {comp.snippet && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {comp.snippet}
                                                </p>
                                            )}
                                        </div>
                                        <a
                                            href={comp.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all shrink-0"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <AlertCircle size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                                <p className="text-sm text-muted-foreground">No competitor data available</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-primary" />
                            Rank History Chart
                        </h3>
                        {tracking.rankHistory.length > 0 ? (
                            <div className="bg-muted/30 rounded-xl p-4">
                                <canvas
                                    ref={chartRef}
                                    className="w-full"
                                    style={{ height: "300px" }}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <AlertCircle size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                                <p className="text-sm text-muted-foreground">No history data available yet</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}