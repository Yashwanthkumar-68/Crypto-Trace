import { TaintTransaction } from './taintAnalysis';

export interface GasCluster {
  parentGasWallet: string;
  fundedSuspects: string[];
  confidenceScore: number;
  totalGasFunded: number;
}

/**
 * Traces backwards to find the "Master Gas Funder".
 * Criminals spin up hundreds of temporary wallets and fund them with tiny amounts of ETH for gas.
 * This algorithm groups wallets based on their shared initial funding source.
 * 
 * @param allTransactions Historical blockchain transactions
 * @param suspectWallets Array of known suspect wallets involved in a case
 */
export const detectGasClusters = (
  allTransactions: TaintTransaction[],
  suspectWallets: string[]
): GasCluster[] => {
  // Map of suspect wallet -> address that funded it first
  const initialFunders = new Map<string, { funder: string; amount: number }>();
  
  // Sort transactions chronologically
  const sortedTx = [...allTransactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const suspectSet = new Set(suspectWallets.map(w => w.toLowerCase()));

  // Find the first incoming transaction for every suspect wallet
  sortedTx.forEach((tx) => {
    const to = tx.to_address.toLowerCase();
    
    // If it's a suspect wallet and it hasn't received funds yet in our ledger
    if (suspectSet.has(to) && !initialFunders.has(to)) {
      // Check if it's a tiny "gas" amount (e.g. < 0.05 ETH)
      if (tx.value > 0 && tx.value < 0.05) {
        initialFunders.set(to, { funder: tx.from_address.toLowerCase(), amount: tx.value });
      }
    }
  });

  // Group by the funder (the Master Gas Wallet)
  const clusters = new Map<string, GasCluster>();

  initialFunders.forEach((fundingData, suspectAddress) => {
    const funder = fundingData.funder;
    
    if (!clusters.has(funder)) {
      clusters.set(funder, {
        parentGasWallet: funder,
        fundedSuspects: [],
        confidenceScore: 0,
        totalGasFunded: 0
      });
    }

    const cluster = clusters.get(funder)!;
    cluster.fundedSuspects.push(suspectAddress);
    cluster.totalGasFunded += fundingData.amount;
  });

  // Calculate confidence score (higher if one parent funds MANY suspects)
  const result: GasCluster[] = [];
  clusters.forEach((cluster) => {
    // If a wallet only funded 1 suspect, it might just be a random transfer or an exchange withdrawal
    if (cluster.fundedSuspects.length > 1) {
      // Base confidence + (10 points per funded suspect)
      cluster.confidenceScore = Math.min(99.9, 50 + (cluster.fundedSuspects.length * 10));
      result.push(cluster);
    }
  });

  // Sort by highest confidence
  return result.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

export interface GasFunderInfo {
  parentGasWallet: string;
  clusterSize: number;
  confidenceScore: number;
  totalGasFunded: number;
}

/**
 * Creates an O(1) map from suspect wallet to its parent gas funder information.
 */
export const getGasFunderMap = (clusters: GasCluster[]): Map<string, GasFunderInfo> => {
  const map = new Map<string, GasFunderInfo>();
  clusters.forEach((cluster) => {
    cluster.fundedSuspects.forEach((suspect) => {
      map.set(suspect.toLowerCase(), {
        parentGasWallet: cluster.parentGasWallet,
        clusterSize: cluster.fundedSuspects.length,
        confidenceScore: cluster.confidenceScore,
        totalGasFunded: cluster.totalGasFunded
      });
    });
  });
  return map;
};
