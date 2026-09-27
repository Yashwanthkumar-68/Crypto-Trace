export type CryptoCurrency = 'EVM' | 'BTC' | 'SOL' | 'TRX' | 'UNKNOWN';

export interface CurrencyDetectionResult {
  currency: CryptoCurrency;
  networkName: string;
  name: string;
  symbol: string;
  isValid: boolean;
  explorerUrl: string;
  color: string;
  badgeStyle: string;
  badgeColor: string;
  formatDescription: string;
}

/**
 * Automatically detects the cryptocurrency blockchain network based on cryptographic wallet address rules.
 */
export const detectCurrencyType = (address: string): CurrencyDetectionResult => {
  const cleanAddress = address.trim();

  // 1. EVM (Ethereum, BSC, Polygon, Arbitrum, Optimism)
  // Starts with 0x followed by 40 hexadecimal characters
  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  if (evmRegex.test(cleanAddress)) {
    return {
      currency: 'EVM',
      networkName: 'Ethereum / EVM Compatible',
      name: 'Ethereum / EVM Compatible',
      symbol: 'ETH',
      isValid: true,
      explorerUrl: `https://sepolia.etherscan.io/address/${cleanAddress}`,
      color: 'blue',
      badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      formatDescription: '0x Hexadecimal (20 bytes / 40 hex chars)'
    };
  }

  // 2. Bitcoin (BTC)
  // Legacy P2PKH starts with '1' (26-35 chars)
  // Nested SegWit P2SH starts with '3' (26-35 chars)
  // Native SegWit / Taproot Bech32 starts with 'bc1' (42-62 chars)
  const btcRegex = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/;
  if (btcRegex.test(cleanAddress)) {
    return {
      currency: 'BTC',
      networkName: 'Bitcoin Network',
      name: 'Bitcoin Network',
      symbol: 'BTC',
      isValid: true,
      explorerUrl: `https://mempool.space/address/${cleanAddress}`,
      color: 'amber',
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      formatDescription: 'Base58Check / Bech32 SegWit'
    };
  }

  // 3. Tron (TRX)
  // Base58Check string starting with 'T', exactly 34 characters
  const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
  if (tronRegex.test(cleanAddress)) {
    return {
      currency: 'TRX',
      networkName: 'Tron Network (TRC-20)',
      name: 'Tron Network (TRC-20)',
      symbol: 'TRX',
      isValid: true,
      explorerUrl: `https://tronscan.org/#/address/${cleanAddress}`,
      color: 'rose',
      badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      formatDescription: 'Base58Check (Starts with T, 34 chars)'
    };
  }

  // 4. Solana (SOL)
  // Base58 encoded string, 32 to 44 characters
  const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (solRegex.test(cleanAddress)) {
    return {
      currency: 'SOL',
      networkName: 'Solana Network (SPL)',
      name: 'Solana Network (SPL)',
      symbol: 'SOL',
      isValid: true,
      explorerUrl: `https://solscan.io/account/${cleanAddress}`,
      color: 'purple',
      badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      formatDescription: 'Base58 Public Key (32-44 chars)'
    };
  }

  return {
    currency: 'UNKNOWN',
    networkName: 'Unknown / Unsupported',
    name: 'Unknown / Unsupported',
    symbol: '???',
    isValid: false,
    explorerUrl: '#',
    color: 'slate',
    badgeStyle: 'bg-slate-100 text-slate-600 border-slate-300',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-300',
    formatDescription: 'Unrecognized format'
  };
};

