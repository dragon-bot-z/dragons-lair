const { createPublicClient, createWalletClient, http, formatUnits, parseUnits, maxUint256 } = require('viem');
const { base } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const DRAGONFIRE = '0xa21b9Ab723669743934F5Fa78E8cC7D4Fc72600e';
const DRAGON = '0xD113b2cb6A38863F8e8232cBD5743B61Bb3c6B07';
const THRESHOLD = parseUnits('500000', 18);

const RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const account = privateKeyToAccount(process.env.MY_PRIVATE_KEY);

const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) });

const erc20Abi = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

const dragonfireAbi = [
  { name: 'currentPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

async function main() {
  const price = await publicClient.readContract({ address: DRAGONFIRE, abi: dragonfireAbi, functionName: 'currentPrice' });
  const priceFormatted = formatUnits(price, 18);
  console.log(`PRICE: ${priceFormatted} DRAGON`);

  if (price >= THRESHOLD) {
    console.log(`STATUS: TOO_HIGH`);
    return;
  }

  console.log(`STATUS: BELOW_THRESHOLD`);

  // Check allowance
  const allowance = await publicClient.readContract({ address: DRAGON, abi: erc20Abi, functionName: 'allowance', args: [account.address, DRAGONFIRE] });
  console.log(`ALLOWANCE: ${formatUnits(allowance, 18)} DRAGON`);

  if (allowance < price) {
    console.log('APPROVING...');
    const approveTx = await walletClient.writeContract({ address: DRAGON, abi: erc20Abi, functionName: 'approve', args: [DRAGONFIRE, maxUint256] });
    console.log(`APPROVE_TX: ${approveTx}`);
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('APPROVED');
  }

  console.log('MINTING...');
  const mintTx = await walletClient.writeContract({ address: DRAGONFIRE, abi: dragonfireAbi, functionName: 'mint' });
  console.log(`MINT_TX: ${mintTx}`);
  await publicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log('MINTED');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
