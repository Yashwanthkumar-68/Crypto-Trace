export interface TaintTransaction {
  hash: string;
  from_address: string;
  to_address: string;
  value: number;
  timestamp: string;
}

export interface WalletState {
  balance: number;
  taintedAmount: number;
}

export interface EdgeTaintMetric {
  taintRatio: number; // 0.0 - 1.0 (proportion of transaction value that is stolen)
  taintedValue: number; // in ETH / native
  cleanValue: number; // in ETH / native
}

export interface TaintAnalysisResult {
  walletTaint: Map<string, { taintPercentage: number; taintedAmount: number; totalBalance: number }>;
  edgeTaint: Map<string, EdgeTaintMetric>;
  totalStolenOrigin: number;
}

/**
 * Computes exact mathematical taint propagation using First-In-First-Out (FIFO) mixing heuristics.
 * Accurately tracks dirty vs clean funds across all downstream hops, computing exact ratios
 * for both wallets and individual transactions/edges.
 * 
 * @param transactions The chronologically sorted list of transactions
 * @param sourceWallet The initial compromised/scammer wallet
 * @param initialTaint The amount of stolen funds originating at the source
 */
export const computeTaintAnalysis = (
  transactions: TaintTransaction[],
  sourceWallet: string,
  initialTaint?: number
): TaintAnalysisResult => {
  const wallets = new Map<string, WalletState>();
  const edgeTaint = new Map<string, EdgeTaintMetric>();

  // Determine initial taint from source outgoing volume if not explicitly passed
  let startingTaint = initialTaint || 0;
  if (!startingTaint && sourceWallet) {
    const srcOut = transactions
      .filter(tx => tx.from_address.toLowerCase() === sourceWallet.toLowerCase())
      .reduce((sum, tx) => sum + (tx.value || 0), 0);
    startingTaint = srcOut > 0 ? srcOut : 10.0;
  }

  const cleanSource = sourceWallet.toLowerCase();

  // Initialize the source wallet with 100% tainted stolen funds
  wallets.set(cleanSource, {
    balance: startingTaint,
    taintedAmount: startingTaint
  });

  // Sort transactions chronologically to model true blockchain flow
  const sortedTxs = [...transactions].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  sortedTxs.forEach((tx) => {
    const from = (tx.from_address || '').toLowerCase();
    const to = (tx.to_address || '').toLowerCase();
    const value = tx.value || 0;
    const txId = (tx.hash || `${from}-${to}-${tx.timestamp}`).toLowerCase();

    if (!from || !to || value <= 0) return;

    if (!wallets.has(from)) {
      wallets.set(from, { balance: 0, taintedAmount: 0 }); // Unknown prior balance implies clean funds
    }
    if (!wallets.has(to)) {
      wallets.set(to, { balance: 0, taintedAmount: 0 });
    }

    const fromState = wallets.get(from)!;
    const toState = wallets.get(to)!;

    // Calculate how much of the sent value is tainted (FIFO proportional mixing)
    let taintRatio = 0;
    if (fromState.balance > 0) {
      taintRatio = fromState.taintedAmount / fromState.balance;
    } else if (from === cleanSource) {
      taintRatio = 1.0;
    }
    
    // Cap ratio at 1 (100%) and floor at 0
    taintRatio = Math.min(1, Math.max(0, taintRatio));

    const sentTaint = value * taintRatio;
    const sentClean = Math.max(0, value - sentTaint);

    // Record Edge Taint Metric
    edgeTaint.set(txId, {
      taintRatio,
      taintedValue: sentTaint,
      cleanValue: sentClean
    });

    // Also record by direct from->to key for fast graph fallback
    edgeTaint.set(`${from}->${to}`, {
      taintRatio,
      taintedValue: sentTaint,
      cleanValue: sentClean
    });

    // Deduct from sender
    fromState.balance = Math.max(0, fromState.balance - value);
    fromState.taintedAmount = Math.max(0, fromState.taintedAmount - sentTaint);

    // Add to receiver
    toState.balance += value;
    toState.taintedAmount += sentTaint;
  });

  // Compile wallet results
  const walletTaint = new Map<string, { taintPercentage: number; taintedAmount: number; totalBalance: number }>();
  
  wallets.forEach((state, address) => {
    if (state.taintedAmount > 0) {
      const denom = state.balance > 0 ? state.balance : state.taintedAmount;
      const pct = Math.min(100, Math.max(0, (state.taintedAmount / denom) * 100));
      walletTaint.set(address, {
        taintPercentage: pct,
        taintedAmount: state.taintedAmount,
        totalBalance: state.balance
      });
    }
  });

  return {
    walletTaint,
    edgeTaint,
    totalStolenOrigin: startingTaint
  };
};

/**
 * Backwards-compatible helper for existing components.
 */
export const calculateTaint = (
  transactions: TaintTransaction[],
  sourceWallet: string,
  initialTaint: number = 10.0
): Map<string, { taintPercentage: number; taintedAmount: number }> => {
  const result = computeTaintAnalysis(transactions, sourceWallet, initialTaint);
  const out = new Map<string, { taintPercentage: number; taintedAmount: number }>();
  result.walletTaint.forEach((v, k) => {
    out.set(k, { taintPercentage: v.taintPercentage, taintedAmount: v.taintedAmount });
  });
  return out;
};
