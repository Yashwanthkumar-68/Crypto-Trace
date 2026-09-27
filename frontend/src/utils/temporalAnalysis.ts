import { TaintTransaction } from './taintAnalysis';

export interface TemporalAlert {
  type: 'BOT_ACTIVITY' | 'STRUCTURING' | 'RAPID_LIQUIDATION';
  severity: 'HIGH' | 'CRITICAL';
  wallet: string;
  message: string;
  evidence: string[];
}

/**
 * Analyzes the temporal (time-based) properties of transactions to mathematically fingerprint bot activity and structuring.
 */
export const detectTemporalAnomalies = (
  transactions: TaintTransaction[],
  suspectWallets: string[]
): TemporalAlert[] => {
  const alerts: TemporalAlert[] = [];
  const suspectSet = new Set(suspectWallets.map(w => w.toLowerCase()));

  // Group transactions by sender
  const txBySender = new Map<string, TaintTransaction[]>();
  
  transactions.forEach(tx => {
    const from = tx.from_address.toLowerCase();
    if (suspectSet.has(from)) {
      if (!txBySender.has(from)) txBySender.set(from, []);
      txBySender.get(from)!.push(tx);
    }
  });

  txBySender.forEach((txs, wallet) => {
    // Sort chronological
    txs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (txs.length < 3) return; // Need at least 3 to form a temporal pattern

    // 1. Bot Detection (Velocity Analysis)
    let rapidSuccessionCount = 0;
    const BOT_THRESHOLD_MS = 2500; // 2.5 seconds

    for (let i = 1; i < txs.length; i++) {
      const timeA = new Date(txs[i-1].timestamp).getTime();
      const timeB = new Date(txs[i].timestamp).getTime();
      const deltaMs = timeB - timeA;

      if (deltaMs > 0 && deltaMs <= BOT_THRESHOLD_MS) {
        rapidSuccessionCount++;
      }
    }

    if (rapidSuccessionCount >= 3) {
      alerts.push({
        type: 'BOT_ACTIVITY',
        severity: 'CRITICAL',
        wallet,
        message: `Automated Bot Fingerprint Detected`,
        evidence: [
          `${rapidSuccessionCount + 1} transactions executed with < 2.5s intervals.`,
          'Impossible for a human operator via standard UI.'
        ]
      });
    }

    // 2. Structuring / Smurfing Detection (KYC bypass)
    // Find clusters of transactions that are nearly identical in size, summing to > $10k
    let smurfCount = 0;
    let smurfSum = 0;
    const SUSPICIOUS_AMOUNT_NATIVE = 3.0; // E.g., ~ $8k-$9k close to $10k limit
    
    txs.forEach(tx => {
      // If they are making rapid transfers just below typical reporting thresholds
      if (tx.value >= (SUSPICIOUS_AMOUNT_NATIVE * 0.8) && tx.value <= SUSPICIOUS_AMOUNT_NATIVE * 1.1) {
        smurfCount++;
        smurfSum += tx.value;
      }
    });

    if (smurfCount >= 4) {
      alerts.push({
        type: 'STRUCTURING',
        severity: 'HIGH',
        wallet,
        message: `KYC Structuring / Smurfing Detected`,
        evidence: [
          `${smurfCount} identical transactions just below reporting thresholds.`,
          `Total structured volume: ${smurfSum.toFixed(2)} ETH.`
        ]
      });
    }
  });

  return alerts;
};

export interface TemporalFingerprint {
  isBot: boolean;
  isStructuring: boolean;
  alerts: TemporalAlert[];
}

/**
 * Returns an O(1) lookup map of suspect wallet -> temporal fingerprint (bot / smurfing).
 */
export const getTemporalFingerprintMap = (
  transactions: TaintTransaction[],
  suspectWallets: string[]
): Map<string, TemporalFingerprint> => {
  const alerts = detectTemporalAnomalies(transactions, suspectWallets);
  const map = new Map<string, TemporalFingerprint>();

  alerts.forEach(alert => {
    const key = alert.wallet.toLowerCase();
    const existing = map.get(key) || {
      isBot: false,
      isStructuring: false,
      alerts: []
    };

    if (alert.type === 'BOT_ACTIVITY') existing.isBot = true;
    if (alert.type === 'STRUCTURING') existing.isStructuring = true;
    existing.alerts.push(alert);

    map.set(key, existing);
  });

  return map;
};
