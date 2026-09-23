import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { 
  ShieldAlert, 
  Building2, 
  Wallet, 
  ArrowRight, 
  Clock, 
  Coins, 
  AlertTriangle, 
  Search, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  Filter, 
  FileCheck2,
  Sparkles,
  Info
} from 'lucide-react';
import { Transaction } from '../types';

export interface ThreatGraphNode {
  id: string;
  address: string;
  label: string;
  type: 'suspect' | 'exchange' | 'mule' | 'mixer' | 'victim';
  exchangeName?: string;
  walletAge: string;
  balanceNative: number;
  balanceCurrency: string;
  balanceInr: number;
  riskScore: number; // 0 - 100
  txCount: number;
  firstSeen: string;
  lastSeen: string;
  isSuspect: boolean;
  x?: number;
  y?: number;
}

export interface ThreatGraphLink {
  id: string;
  source: string | ThreatGraphNode;
  target: string | ThreatGraphNode;
  amount: number;
  currency: string;
  amountInr: number;
  timestamp: string;
  txHash: string;
  patternType: 'Direct Transfer' | 'Peeling Chain Split' | 'Layering Mule Transit' | 'CEX Liquidation Deposit' | 'DeFi Bridge Route';
  isHighRisk?: boolean;
}

interface ThreatGraphProps {
  transactions?: Transaction[];
  suspectWallet?: string;
  onInspectWallet?: (address: string) => void;
  onGenerateSubpoena?: (walletAddress: string) => void;
}

// Known exchange signatures
const KNOWN_EXCHANGES: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance 14 (Hot Wallet)',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance Deposit Hub',
  '0x564286362092d8e7936f0549571a803b203aaced': 'Binance Hot 19',
  '0x72a53cd226fb190795265086ba9e402b1f8615b3': 'WazirX Liquidation Reserve',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io Exchange',
  '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2': 'FTX / Alameda Recovery',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'CoinDCX Secure Vault',
  '0x70faa28a6b8dbe2ec43602d3Ab04e124F6481A4a': 'Kraken Deposit Node',
  '0x12b23616223405788f8d9b152349ef87b03a110a': 'OKX Settlement Hot Wallet'
};

export const ThreatGraph: React.FC<ThreatGraphProps> = ({
  transactions = [],
  suspectWallet = '',
  onInspectWallet,
  onGenerateSubpoena
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<ThreatGraphNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<ThreatGraphLink | null>(null);
  const [selectedNode, setSelectedNode] = useState<ThreatGraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'high_risk' | 'exchanges'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [particlesActive, setParticlesActive] = useState(true);

  // Resize observer to make graph 100% responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: Math.max(540, containerRef.current.clientHeight || 580)
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Format currency helpers
  const formatInr = (amt: number) => `₹${Math.round(amt).toLocaleString('en-IN')}`;
  const shortenAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Build Graph Data from actual transactions or populate rich forensic mock dataset
  const graphData = useMemo(() => {
    const cleanSuspect = suspectWallet.toLowerCase();

    // If transactions are provided and has at least 3 items, build from transactions
    if (transactions && transactions.length >= 3) {
      const nodeMap = new Map<string, ThreatGraphNode>();
      const links: ThreatGraphLink[] = [];

      transactions.forEach((tx, idx) => {
        const from = tx.from_address.toLowerCase();
        const to = tx.to_address.toLowerCase();

        // Register Source Node
        if (!nodeMap.has(from)) {
          const isSus = from === cleanSuspect;
          const exName = KNOWN_EXCHANGES[from];
          nodeMap.set(from, {
            id: from,
            address: tx.from_address,
            label: isSus ? 'Target Suspect Wallet' : exName ? exName : `Hop Sender ${from.slice(0, 6)}`,
            type: isSus ? 'suspect' : exName ? 'exchange' : 'mule',
            exchangeName: exName,
            walletAge: isSus ? '28 days (Recent Burner)' : '1 yr 4 mos',
            balanceNative: isSus ? 4.82 : 1.25,
            balanceCurrency: tx.blockchain === 'Bitcoin' ? 'BTC' : 'ETH',
            balanceInr: isSus ? 1285000 : 340000,
            riskScore: isSus ? 98 : exName ? 15 : 68,
            txCount: 14 + idx * 3,
            firstSeen: '2026-08-15 10:20:00',
            lastSeen: '2026-09-21 16:45:00',
            isSuspect: isSus
          });
        }

        // Register Target Node
        if (!nodeMap.has(to)) {
          const isSus = to === cleanSuspect;
          const exName = KNOWN_EXCHANGES[to];
          nodeMap.set(to, {
            id: to,
            address: tx.to_address,
            label: isSus ? 'Target Suspect Wallet' : exName ? exName : `Mule Collector ${to.slice(0, 6)}`,
            type: isSus ? 'suspect' : exName ? 'exchange' : 'mule',
            exchangeName: exName,
            walletAge: exName ? '4 yrs 2 mos' : '45 days',
            balanceNative: exName ? 2450.5 : 0.84,
            balanceCurrency: tx.blockchain === 'Bitcoin' ? 'BTC' : 'ETH',
            balanceInr: exName ? 650000000 : 225000,
            riskScore: isSus ? 98 : exName ? 12 : 74,
            txCount: exName ? 14200 : 8,
            firstSeen: '2026-08-20 09:15:00',
            lastSeen: '2026-09-22 18:30:00',
            isSuspect: isSus
          });
        }

        const amtInr = (tx.amount_native || 1.5) * 268000;
        links.push({
          id: tx.transaction_hash || `link-${idx}`,
          source: from,
          target: to,
          amount: tx.amount_native || 1.25,
          currency: tx.blockchain === 'Bitcoin' ? 'BTC' : 'ETH',
          amountInr: amtInr,
          timestamp: tx.timestamp || new Date().toISOString(),
          txHash: tx.transaction_hash || `0x7b23${idx}ef98a`,
          patternType: KNOWN_EXCHANGES[to] ? 'CEX Liquidation Deposit' : 'Peeling Chain Split',
          isHighRisk: true
        });
      });

      return {
        nodes: Array.from(nodeMap.values()),
        links
      };
    }

    // Default Rich Forensic Dataset for Demo
    const primarySuspect = suspectWallet || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const sId = primarySuspect.toLowerCase();

    const mockNodes: ThreatGraphNode[] = [
      {
        id: '0xvictim99824a187a4129b054238e814032d8471e98',
        address: '0xVictim99824A187a4129B054238E814032D8471e98',
        label: 'Victim Complainant Wallet',
        type: 'victim',
        walletAge: '2 yrs 1 mo',
        balanceNative: 0.12,
        balanceCurrency: 'ETH',
        balanceInr: 32160,
        riskScore: 8,
        txCount: 42,
        firstSeen: '2024-07-12 11:20:00',
        lastSeen: '2026-09-10 14:15:00',
        isSuspect: false
      },
      {
        id: sId,
        address: primarySuspect,
        label: 'Primary Suspect Intake Hub',
        type: 'suspect',
        walletAge: '14 days (Recent Burner)',
        balanceNative: 8.45,
        balanceCurrency: 'ETH',
        balanceInr: 2264600,
        riskScore: 98,
        txCount: 38,
        firstSeen: '2026-09-09 08:30:15',
        lastSeen: '2026-09-22 17:45:00',
        isSuspect: true
      },
      {
        id: '0x4f1289c025114da088234071355e5743bf19920',
        address: '0x4F1289c025114dA088234071355e5743BF19920',
        label: 'Peeling Splitter Mule A',
        type: 'mule',
        walletAge: '22 days',
        balanceNative: 1.15,
        balanceCurrency: 'ETH',
        balanceInr: 308200,
        riskScore: 88,
        txCount: 19,
        firstSeen: '2026-09-10 16:20:00',
        lastSeen: '2026-09-22 12:10:00',
        isSuspect: false
      },
      {
        id: '0x9924acbe1893245086ba9e402b1f8615b3187210',
        address: '0x9924acBE1893245086BA9E402B1F8615B3187210',
        label: 'Rapid Layering Transit Mule B',
        type: 'mule',
        walletAge: '8 days (Ephemeral)',
        balanceNative: 0.42,
        balanceCurrency: 'ETH',
        balanceInr: 112560,
        riskScore: 92,
        txCount: 9,
        firstSeen: '2026-09-11 02:40:00',
        lastSeen: '2026-09-21 23:15:00',
        isSuspect: false
      },
      {
        id: '0x8812cde4414fe77e2327f0bf4ae2a264a7788410',
        address: '0x8812cde4414FE77E2327f0BF4Ae2A264a7788410',
        label: 'Obfuscation Mixer / Bridge Proxy',
        type: 'mixer',
        walletAge: '1 yr 8 mos',
        balanceNative: 124.8,
        balanceCurrency: 'ETH',
        balanceInr: 33446400,
        riskScore: 95,
        txCount: 2840,
        firstSeen: '2025-01-05 14:10:00',
        lastSeen: '2026-09-23 04:12:00',
        isSuspect: false
      },
      {
        id: '0x28c6c06298d514db089934071355e5743bf21d60',
        address: '0x28c6c06298d514db089934071355e5743bf21d60',
        label: 'Binance 14 Hot Liquidation',
        type: 'exchange',
        exchangeName: 'Binance 14 (Hot Wallet)',
        walletAge: '5 yrs 6 mos',
        balanceNative: 148500.0,
        balanceCurrency: 'ETH',
        balanceInr: 39798000000,
        riskScore: 12,
        txCount: 489000,
        firstSeen: '2021-03-10 00:00:00',
        lastSeen: '2026-09-23 12:45:00',
        isSuspect: false
      },
      {
        id: '0x72a53cd226fb190795265086ba9e402b1f8615b3',
        address: '0x72a53cd226fb190795265086ba9e402b1f8615b3',
        label: 'WazirX Liquidation Reserve',
        type: 'exchange',
        exchangeName: 'WazirX INR Gateway',
        walletAge: '4 yrs 1 mo',
        balanceNative: 1240.0,
        balanceCurrency: 'ETH',
        balanceInr: 332320000,
        riskScore: 14,
        txCount: 92400,
        firstSeen: '2022-08-14 10:00:00',
        lastSeen: '2026-09-23 11:20:00',
        isSuspect: false
      },
      {
        id: '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
        address: '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
        label: 'CoinDCX Domestic Exit Node',
        type: 'exchange',
        exchangeName: 'CoinDCX KYC Deposit Hub',
        walletAge: '3 yrs 9 mos',
        balanceNative: 890.5,
        balanceCurrency: 'ETH',
        balanceInr: 238654000,
        riskScore: 10,
        txCount: 68100,
        firstSeen: '2022-12-01 09:00:00',
        lastSeen: '2026-09-23 10:15:00',
        isSuspect: false
      },
      {
        id: '0x3310bb24e819ac4058d9b152349ef87b03a110a1',
        address: '0x3310bB24e819Ac4058D9b152349EF87b03a110A1',
        label: 'Secondary Transit Mule C',
        type: 'mule',
        walletAge: '18 days',
        balanceNative: 0.95,
        balanceCurrency: 'ETH',
        balanceInr: 254600,
        riskScore: 82,
        txCount: 14,
        firstSeen: '2026-09-12 18:20:00',
        lastSeen: '2026-09-22 14:05:00',
        isSuspect: false
      }
    ];

    const mockLinks: ThreatGraphLink[] = [
      {
        id: 'tx-hop-1',
        source: '0xvictim99824a187a4129b054238e814032d8471e98',
        target: sId,
        amount: 2.5,
        currency: 'ETH',
        amountInr: 670000,
        timestamp: '2026-09-10 14:15:22 IST',
        txHash: '0x9fa138a0bc192841029471b05819ef38192a0149182371948201fa81920ac391',
        patternType: 'Direct Transfer',
        isHighRisk: true
      },
      {
        id: 'tx-hop-2',
        source: sId,
        target: '0x4f1289c025114da088234071355e5743bf19920',
        amount: 1.85,
        currency: 'ETH',
        amountInr: 495800,
        timestamp: '2026-09-10 14:28:40 IST',
        txHash: '0x88a101b0f1928471029384710192837401928374019283740192837401928374',
        patternType: 'Peeling Chain Split',
        isHighRisk: true
      },
      {
        id: 'tx-hop-3',
        source: sId,
        target: '0x3310bb24e819ac4058d9b152349ef87b03a110a1',
        amount: 0.65,
        currency: 'ETH',
        amountInr: 174200,
        timestamp: '2026-09-10 14:35:10 IST',
        txHash: '0x77b219a0bc1928471029384710192837401928374019283740192837401928375',
        patternType: 'Peeling Chain Split',
        isHighRisk: true
      },
      {
        id: 'tx-hop-4',
        source: '0x4f1289c025114da088234071355e5743bf19920',
        target: '0x9924acbe1893245086ba9e402b1f8615b3187210',
        amount: 1.7,
        currency: 'ETH',
        amountInr: 455600,
        timestamp: '2026-09-10 15:02:18 IST',
        txHash: '0x66c301c0f1928471029384710192837401928374019283740192837401928376',
        patternType: 'Layering Mule Transit',
        isHighRisk: true
      },
      {
        id: 'tx-hop-5',
        source: '0x9924acbe1893245086ba9e402b1f8615b3187210',
        target: '0x8812cde4414fe77e2327f0bf4ae2a264a7788410',
        amount: 1.6,
        currency: 'ETH',
        amountInr: 428800,
        timestamp: '2026-09-10 16:45:00 IST',
        txHash: '0x55d401d0f1928471029384710192837401928374019283740192837401928377',
        patternType: 'DeFi Bridge Route',
        isHighRisk: true
      },
      {
        id: 'tx-hop-6',
        source: '0x8812cde4414fe77e2327f0bf4ae2a264a7788410',
        target: '0x28c6c06298d514db089934071355e5743bf21d60',
        amount: 1.15,
        currency: 'ETH',
        amountInr: 308200,
        timestamp: '2026-09-10 18:12:44 IST',
        txHash: '0x44e501e0f1928471029384710192837401928374019283740192837401928378',
        patternType: 'CEX Liquidation Deposit',
        isHighRisk: false
      },
      {
        id: 'tx-hop-7',
        source: '0x8812cde4414fe77e2327f0bf4ae2a264a7788410',
        target: '0x72a53cd226fb190795265086ba9e402b1f8615b3',
        amount: 0.45,
        currency: 'ETH',
        amountInr: 120600,
        timestamp: '2026-09-10 19:30:12 IST',
        txHash: '0x33f601f0f1928471029384710192837401928374019283740192837401928379',
        patternType: 'CEX Liquidation Deposit',
        isHighRisk: false
      },
      {
        id: 'tx-hop-8',
        source: '0x3310bb24e819ac4058d9b152349ef87b03a110a1',
        target: '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
        amount: 0.6,
        currency: 'ETH',
        amountInr: 160800,
        timestamp: '2026-09-10 20:05:55 IST',
        txHash: '0x22a701a0f1928471029384710192837401928374019283740192837401928380',
        patternType: 'CEX Liquidation Deposit',
        isHighRisk: false
      }
    ];

    return {
      nodes: mockNodes,
      links: mockLinks
    };
  }, [transactions, suspectWallet]);

  // Filtered dataset according to investigator toggle
  const filteredData = useMemo(() => {
    let nodes = [...graphData.nodes];
    let links = [...graphData.links];

    if (filterType === 'high_risk') {
      const highRiskNodeIds = new Set(nodes.filter(n => n.riskScore >= 70 || n.isSuspect).map(n => n.id));
      nodes = nodes.filter(n => highRiskNodeIds.has(n.id));
      links = links.filter(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return highRiskNodeIds.has(sId) && highRiskNodeIds.has(tId);
      });
    } else if (filterType === 'exchanges') {
      const exchangeIds = new Set(nodes.filter(n => n.type === 'exchange' || n.isSuspect).map(n => n.id));
      links = links.filter(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return exchangeIds.has(tId) || exchangeIds.has(sId);
      });
      const activeIds = new Set<string>();
      links.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        activeIds.add(sId);
        activeIds.add(tId);
      });
      nodes = nodes.filter(n => activeIds.has(n.id) || n.isSuspect);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      nodes = nodes.map(n => ({
        ...n,
        _highlight: n.address.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
      }));
    }

    return { nodes, links };
  }, [graphData, filterType, searchQuery]);

  // Search handler to center on node
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !fgRef.current) return;
    const target = filteredData.nodes.find(n => 
      n.address.toLowerCase().includes(searchQuery.toLowerCase().trim()) || 
      n.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
    if (target && target.x !== undefined && target.y !== undefined) {
      fgRef.current.centerAt(target.x, target.y, 1000);
      fgRef.current.zoom(2.5, 1000);
      setSelectedNode(target);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.35, 400);
  };

  const handleZoomOut = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 0.75, 400);
  };

  const handleFitView = () => {
    if (fgRef.current) fgRef.current.zoomToFit(600, 50);
  };

  // Node Painting Canvas Function
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSuspect = node.isSuspect;
    const isExchange = node.type === 'exchange';
    const isMixer = node.type === 'mixer';
    const isVictim = node.type === 'victim';
    const isHovered = hoveredNode?.id === node.id || selectedNode?.id === node.id;
    const isSearchMatch = node._highlight;

    // Node Radius
    const baseRadius = isSuspect ? 12 : isExchange ? 10 : isMixer ? 8 : 7;
    const radius = isHovered ? baseRadius * 1.3 : baseRadius;

    // Colors
    let fillColor = '#3B82F6'; // Default Blue
    let strokeColor = '#1D4ED8';
    let glowColor = 'rgba(59, 130, 246, 0.4)';

    if (isSuspect) {
      fillColor = '#EF4444'; // Red
      strokeColor = '#B91C1C';
      glowColor = 'rgba(239, 68, 68, 0.6)';
    } else if (isExchange) {
      fillColor = '#10B981'; // Green
      strokeColor = '#047857';
      glowColor = 'rgba(16, 185, 129, 0.5)';
    } else if (isMixer) {
      fillColor = '#F59E0B'; // Amber
      strokeColor = '#B45309';
      glowColor = 'rgba(245, 158, 11, 0.5)';
    } else if (isVictim) {
      fillColor = '#8B5CF6'; // Purple
      strokeColor = '#6D28D9';
      glowColor = 'rgba(139, 92, 246, 0.4)';
    }

    if (isSearchMatch) {
      glowColor = 'rgba(250, 204, 21, 0.9)'; // Yellow beacon
    }

    // Outer Glow Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + (isSuspect ? 8 : isHovered ? 6 : 3), 0, 2 * Math.PI, false);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // Concentric Pulse Ring for Suspect Node
    if (isSuspect) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 14, 0, 2 * Math.PI, false);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Main Node Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();

    // Node Center Glyph / Indicator
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 0.4, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Node Label (rendered when scaled or hovered)
    if (globalScale > 1.2 || isHovered || isSuspect || isExchange) {
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${isSuspect ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelText = isSuspect ? `🚨 SUSPECT TARGET (${shortenAddr(node.address)})` : node.exchangeName || shortenAddr(node.address);
      const textWidth = ctx.measureText(labelText).width;
      const bPadding = 2;

      // Label background plate
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(
        node.x - textWidth / 2 - bPadding,
        node.y + radius + 4 - bPadding,
        textWidth + bPadding * 2,
        fontSize + bPadding * 2
      );

      // Label text
      ctx.fillStyle = isSuspect ? '#FCA5A5' : isExchange ? '#6EE7B7' : '#E2E8F0';
      ctx.fillText(labelText, node.x, node.y + radius + 4);
    }
  }, [hoveredNode, selectedNode]);

  // Pointer Area Paint for accurate hover
  const paintPointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const isSuspect = node.isSuspect;
    const baseRadius = isSuspect ? 14 : 10;
    ctx.beginPath();
    ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  // Update mouse position for floating profiler positioning
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Forensic Telemetry */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              FORENSIC FORCE-DIRECTED TOPOLOGY
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {filteredData.nodes.length} Nodes · {filteredData.links.length} Transits
            </span>
          </div>
          <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
            Interactive Threat Graph & Peeling Path Explorer
          </h2>
          <p className="text-xs text-slate-400">
            Real-time force graph tracing stolen fund dispersion from the suspect origin into intermediate mule clusters and final exchange (VASP) off-ramps.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search wallet or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all font-mono"
            />
          </form>

          {/* Filter Toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filterType === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('high_risk')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filterType === 'high_risk' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title="Show only addresses with Risk Score >= 70"
            >
              High Risk
            </button>
            <button
              onClick={() => setFilterType('exchanges')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filterType === 'exchanges' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title="Filter paths terminating in Exchange Deposits"
            >
              Exchanges
            </button>
          </div>

          {/* Zoom & View Controls */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 text-slate-300">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              className="p-1.5 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
              title="Fit View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setParticlesActive(!particlesActive)}
              className={`p-1.5 rounded-lg transition-all ${particlesActive ? 'text-amber-400 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
              title="Toggle Fund-Flow Particles"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`p-1.5 rounded-lg transition-all ${showLegend ? 'bg-slate-700 text-blue-400' : 'hover:bg-slate-700 hover:text-white'}`}
              title="Toggle Color Legend"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Graph Container */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full h-[580px] bg-[#090D16] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl"
      >
        {/* Floating Quick Legend */}
        {showLegend && (
          <div className="absolute top-4 left-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-xs text-white shadow-2xl space-y-2 pointer-events-auto max-w-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Node Taxonomy</span>
              <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
                <span><strong>Suspect Wallet</strong> (Target under investigation)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                <span><strong>Known Exchange (VASP)</strong> (Binance, WazirX, etc.)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span><strong>Layering Mule</strong> (Intermediate transit account)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span><strong>Mixer / DeFi Hub</strong> (Obfuscation protocol)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span><strong>Victim Complainant</strong> (Origin of stolen funds)</span>
              </div>
              <div className="pt-1.5 border-t border-slate-800 flex items-center gap-1.5 text-amber-300/90 text-[10px]">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Moving dots show live direction & velocity of fund flow</span>
              </div>
            </div>
          </div>
        )}

        {/* ForceGraph2D Canvas */}
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={filteredData}
          nodeId="id"
          nodeLabel={() => ''} // Disabled default browser tooltip in favor of our custom Node Profiler
          linkLabel={() => ''} // Disabled default browser tooltip in favor of our custom Edge Profiler
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={() => '#64748B'}
          linkCurvature={0.15}
          linkColor={(link: any) => link.isHighRisk ? '#EF4444' : '#475569'}
          linkWidth={(link: any) => link.isHighRisk ? 2.0 : 1.2}
          linkDirectionalParticles={particlesActive ? 3 : 0}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleWidth={2.4}
          linkDirectionalParticleColor={(link: any) => link.isHighRisk ? '#FCA5A5' : '#60A5FA'}
          onNodeHover={(node: any) => setHoveredNode(node || null)}
          onLinkHover={(link: any) => setHoveredLink(link || null)}
          onNodeClick={(node: any) => {
            setSelectedNode(node);
            if (node.address && onInspectWallet) {
              onInspectWallet(node.address);
            }
          }}
          cooldownTicks={120}
          onEngineStop={() => {
            if (fgRef.current && filteredData.nodes.length > 0) {
              fgRef.current.zoomToFit(400, 60);
            }
          }}
        />

        {/* [INNOVATION 1]: Floating Node Profiler Tooltip */}
        {hoveredNode && !hoveredLink && (
          <div 
            style={{
              position: 'absolute',
              left: Math.min(mousePos.x + 16, dimensions.width - 320),
              top: Math.min(mousePos.y + 16, dimensions.height - 280),
              pointerEvents: 'none'
            }}
            className="z-30 w-76 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header with Classification Badge */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border inline-flex items-center gap-1 ${
                  hoveredNode.isSuspect 
                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                    : hoveredNode.type === 'exchange'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : hoveredNode.type === 'mixer'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {hoveredNode.isSuspect ? '🚨 Target Suspect' : hoveredNode.type === 'exchange' ? '🏦 Verified VASP Exit' : '👤 Money Mule Account'}
                </span>
                <h4 className="text-xs font-bold text-white mt-1">
                  {hoveredNode.exchangeName || hoveredNode.label}
                </h4>
              </div>

              {/* 1-Click Copy */}
              <button 
                onClick={(e) => copyToClipboard(hoveredNode.address, e)}
                className="pointer-events-auto p-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-all"
                title="Copy Address"
              >
                {copiedText === hoveredNode.address ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Address */}
            <p className="font-mono text-[11px] text-slate-400 break-all bg-black/40 p-2 rounded-lg border border-slate-800">
              {hoveredNode.address}
            </p>

            {/* Node Profiler Grid Attributes */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  Wallet Age
                </p>
                <p className="font-bold text-slate-200 mt-0.5">
                  {hoveredNode.walletAge}
                </p>
              </div>

              <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Coins className="w-3 h-3 text-emerald-400" />
                  Total Balance
                </p>
                <p className="font-bold text-emerald-400 mt-0.5">
                  {hoveredNode.balanceNative.toFixed(2)} {hoveredNode.balanceCurrency}
                </p>
                <p className="text-[9px] text-slate-400 font-mono">
                  {formatInr(hoveredNode.balanceInr)}
                </p>
              </div>
            </div>

            {/* Risk Score Meter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className={`w-3 h-3 ${hoveredNode.riskScore >= 70 ? 'text-red-400' : 'text-emerald-400'}`} />
                  Forensic Risk Score
                </span>
                <span className={`font-bold font-mono ${
                  hoveredNode.riskScore >= 70 ? 'text-red-400' : hoveredNode.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {hoveredNode.riskScore}/100 ({hoveredNode.riskScore >= 70 ? 'CRITICAL' : hoveredNode.riskScore >= 40 ? 'MEDIUM' : 'LOW'})
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    hoveredNode.riskScore >= 70 ? 'bg-red-500' : hoveredNode.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${hoveredNode.riskScore}%` }}
                />
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80">
              <span>Tx Count: <strong>{hoveredNode.txCount.toLocaleString()}</strong></span>
              <span className="text-blue-400">Click node to inspect dossier →</span>
            </div>
          </div>
        )}

        {/* [INNOVATION 2]: Floating Edge Profiler Tooltip */}
        {hoveredLink && (
          <div 
            style={{
              position: 'absolute',
              left: Math.min(mousePos.x + 16, dimensions.width - 320),
              top: Math.min(mousePos.y + 16, dimensions.height - 240),
              pointerEvents: 'none'
            }}
            className="z-30 w-76 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Edge Profiler Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                {hoveredLink.patternType}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {hoveredLink.currency} Transfer
              </span>
            </div>

            {/* Edge Transfer Volume */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                Amount Transferred
              </p>
              <h3 className="text-base font-black text-emerald-400 font-mono mt-0.5">
                {hoveredLink.amount} {hoveredLink.currency}
              </h3>
              <p className="text-xs text-slate-300 font-mono font-medium">
                ≈ {formatInr(hoveredLink.amountInr)}
              </p>
            </div>

            {/* Exact Timestamp */}
            <div className="flex items-center justify-between text-xs bg-slate-800/40 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                Exact Timestamp
              </span>
              <span className="font-mono text-[11px] text-slate-200">
                {hoveredLink.timestamp}
              </span>
            </div>

            {/* Transaction Hash */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Transaction Hash</span>
                <button
                  onClick={(e) => copyToClipboard(hoveredLink.txHash, e)}
                  className="pointer-events-auto text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedText === hoveredLink.txHash ? 'Copied!' : 'Copy Hash'}
                </button>
              </div>
              <p className="font-mono text-[10px] text-slate-300 truncate bg-black/40 p-1.5 rounded border border-slate-800">
                {hoveredLink.txHash}
              </p>
            </div>
          </div>
        )}

        {/* Selected Node Action Card (Bottom Overlay) */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl p-4 text-white shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                selectedNode.isSuspect ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}>
                {selectedNode.isSuspect ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <Wallet className="w-5 h-5 text-blue-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white">
                    {selectedNode.exchangeName || selectedNode.label}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Risk: {selectedNode.riskScore}/100
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {selectedNode.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onGenerateSubpoena && (
                <button
                  onClick={() => onGenerateSubpoena(selectedNode.address)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Generate Section 94 BNSS Statutory Notice for this address"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-purple-200" />
                  <span>Section 94 Subpoena</span>
                </button>
              )}

              {onInspectWallet && (
                <button
                  onClick={() => onInspectWallet(selectedNode.address)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Inspect Wallet</span>
                </button>
              )}

              <button
                onClick={() => setSelectedNode(null)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Forensic Intelligence Footnote */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Exchanges identified in the threat topology: <strong>Binance, WazirX, CoinDCX</strong>. Issue Section 94 BNSS notices directly to freeze destination accounts before off-ramp liquidation.
          </span>
        </div>
        {onGenerateSubpoena && (
          <button
            onClick={() => onGenerateSubpoena(suspectWallet || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e')}
            className="shrink-0 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
          >
            <span>⚖️ 1-Click Suspect Subpoena</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ThreatGraph;
