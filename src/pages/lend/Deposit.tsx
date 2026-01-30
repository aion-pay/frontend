import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, DollarSign, Info, Loader, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlowingButton } from "../../components/GlowingButton";
import LoginWithGoogleButton from "../../components/LoginWithGoogleButton";
import { WalletSelector } from "../../components/WalletSelector";
import { SEO } from "../../components/SEO";
import {
  aptos,
  CONTRACT_ADDRESS,
  ADMIN_ADDRESS,
  fetchUsdcBalance,
  handleTransactionError,
  unitsToUsdc,
  usdcToUnits,
  validateUsdcAmount,
  getPoolStats,
} from "../../lib/contractUtils";

type LockupPeriod = {
  months: number;
  multiplier: number;
  label: string;
};

type LockupPeriodSelectorProps = {
  selectedPeriod: LockupPeriod;
  onPeriodChange: (period: LockupPeriod) => void;
};

const LockupPeriodSelector = ({ selectedPeriod, onPeriodChange }: LockupPeriodSelectorProps) => {
  const periods: LockupPeriod[] = [
    { months: 1, multiplier: 1.0, label: "1 month" },
    { months: 3, multiplier: 1.25, label: "3 months" },
    { months: 6, multiplier: 1.5, label: "6 months" },
    { months: 12, multiplier: 2.0, label: "12 months" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-black">Lockup Period</h3>
        <Info className="w-4 h-4 text-gray-600" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {periods.map((period) => (
          <motion.button
            key={period.months}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPeriodChange(period)}
            className={`p-4 rounded-xl border-2 transition-all duration-300 ${
              selectedPeriod.months === period.months
                ? "border-black bg-gradient-to-r from-black/20 to-gray-700/20"
                : "border-gray-700/50 hover:border-black/50"
            }`}
          >
            <div className="text-center">
              <div className="text-black font-medium mb-1">{period.label}</div>
              <div className="text-black text-sm font-semibold">{period.multiplier}x multiplier</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default function Deposit() {
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState({
    months: 3,
    multiplier: 1.25,
    label: "3 months",
  });
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "depositing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [lendingPoolStats, setLendingPoolStats] = useState({
    totalDeposited: 0,
    totalBorrowed: 0,
    utilizationRate: 0,
    currentAPY: 12.5,
  });

  const { account, connected, signAndSubmitTransaction } = useWallet();

  const handleTransactionErrorLocal = (error: any) => {
    return handleTransactionError(error);
  };

  const getUsdcBalance = async () => {
    if (!account?.address) return;

    try {
      const balance = await fetchUsdcBalance(account.address.toString());
      setUsdcBalance(balance);
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcBalance(1500.75);
    }
  };

  const getLendingPoolStats = async () => {
    try {
      console.log("🔍 Fetching lending pool stats...");

      const poolStats = await getPoolStats();

      if (poolStats) {
        console.log("✅ Pool stats fetched:", poolStats);
        const currentBorrowed = Math.max(0, poolStats.totalBorrowed - poolStats.totalRepaid);

        setLendingPoolStats({
          totalDeposited: poolStats.totalDeposited,
          totalBorrowed: currentBorrowed,
          utilizationRate: poolStats.utilizationRate,
          currentAPY: 12.5,
        });
      } else {
        console.log("❌ Failed to fetch pool stats, setting defaults");
        setLendingPoolStats({
          totalDeposited: 0,
          totalBorrowed: 0,
          utilizationRate: 0,
          currentAPY: 12.5,
        });
      }
    } catch (error) {
      console.error("💥 Error fetching lending pool stats:", error);
      setLendingPoolStats({
        totalDeposited: 0,
        totalBorrowed: 0,
        utilizationRate: 0,
        currentAPY: 12.5,
      });
    }
  };

  const depositUSDC = async (amountUsdc: number) => {
    if (!account?.address) throw new Error("Wallet not connected");

    if (amountUsdc <= 0 || amountUsdc > 1000000) {
      throw new Error("Invalid deposit amount");
    }

    const amountInUnits = usdcToUnits(amountUsdc);
    const unitsNum = parseInt(amountInUnits, 10);
    if (unitsNum > Number.MAX_SAFE_INTEGER) {
      throw new Error("Amount too large");
    }

    const payload: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDRESS}::lending_pool::deposit`,
        functionArguments: [ADMIN_ADDRESS, amountInUnits],
      },
    };

    return await signAndSubmitTransaction(payload);
  };

  const handleDeposit = async () => {
    if (!connected || !account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Please enter a valid deposit amount");
      return;
    }

    const amount = parseFloat(depositAmount);

    if (!validateUsdcAmount(amount)) {
      toast.error("Invalid deposit amount. Please enter a value between 0 and 1,000,000 USDC");
      return;
    }

    if (amount > usdcBalance) {
      toast.error("Insufficient USDC balance");
      return;
    }

    try {
      setTransactionStatus("depositing");
      setErrorMessage("");

      toast.loading("Depositing USDC to lending pool...", { id: "deposit" });

      const result = await depositUSDC(amount);

      console.log("Deposit result:", result);

      toast.success(`Successfully deposited ${amount} USDC to the lending pool!`, {
        id: "deposit",
      });

      setTransactionStatus("success");
      setDepositAmount("");

      await getUsdcBalance();
      await getLendingPoolStats();

      setTimeout(() => setTransactionStatus("idle"), 3000);
    } catch (error: any) {
      console.error("Deposit error:", error);
      const userFriendlyError = handleTransactionErrorLocal(error);
      setErrorMessage(userFriendlyError);
      setTransactionStatus("error");

      toast.error(userFriendlyError, { id: "deposit" });

      setTimeout(() => {
        setTransactionStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  const calculateEstimatedYield = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return 0;
    const amount = parseFloat(depositAmount);
    const baseApy = lendingPoolStats.currentAPY / 100;
    const boostedApy = baseApy * selectedPeriod.multiplier;
    const monthlyYield = (amount * boostedApy) / 12;
    return monthlyYield * selectedPeriod.months;
  };

  const calculateEffectiveAPY = () => {
    return (lendingPoolStats.currentAPY * selectedPeriod.multiplier).toFixed(1);
  };

  useEffect(() => {
    if (connected && account?.address) {
      getUsdcBalance();
      getLendingPoolStats();
    }
  }, [connected, account?.address]);


  return (
    <div className="min-h-screen bg-white text-black">
      <SEO
        title="Stake USDC & Earn Yield | Crypto Collateral Lending | Aion"
        description="Stake your USDC as collateral for crypto credit lines while earning competitive APY. Provide liquidity for crypto-backed credit cards and earn passive income on your stablecoin holdings."
        keywords="stake USDC for credit, USDC staking APY, crypto collateral lending, yield farming USDC, stablecoin lending pool, crypto credit collateral, USDC yield earning, crypto lending platform, DeFi USDC staking"
        ogTitle="Stake USDC & Earn Yield - Crypto Collateral Lending Platform"
        ogDescription="Earn competitive APY by staking USDC as collateral for crypto credit lines. Support crypto-backed spending while generating passive income on your stablecoin assets."
        twitterTitle="Stake USDC & Earn Yield | Crypto Lending Platform"
        twitterDescription="Stake your USDC and earn yield while powering crypto credit cards. Competitive APY, flexible lockup periods, and support the future of crypto spending."
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
            Stake USDC & Earn Yield
          </h1>
          <p className="text-gray-600 text-lg">Stake USDC as collateral for crypto credit lines while earning competitive APY from borrowers</p>
        </motion.div>

        {/* Protocol Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-black mb-4">Lending Pool Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-gray-600 text-sm">Total Deposited</div>
              <div className="text-xl font-bold text-black">${lendingPoolStats.totalDeposited.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600 text-sm">Outstanding Debt</div>
              <div className="text-xl font-bold text-black">
                ${lendingPoolStats.totalBorrowed.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-600 text-sm">Utilization Rate</div>
              <div className="text-xl font-bold text-green-400">{lendingPoolStats.utilizationRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-600 text-sm">Current APY</div>
              <div className="text-xl font-bold text-gray-600">{lendingPoolStats.currentAPY}%</div>
            </div>
          </div>
        </motion.div>

        {!connected ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 text-center"
          >
            <Wallet className="w-16 h-16 text-black mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-black mb-4">Connect Wallet for Crypto Credit</h2>
            <p className="text-gray-600 mb-6">
              Connect your wallet to stake USDC, enable crypto credit lines, and start earning yield on your collateral
            </p>
            <div className="w-full flex flex-row gap-2 justify-center">
              <WalletSelector />
              <LoginWithGoogleButton />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 space-y-8"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">Deposit Amount</h3>
                <div className="text-sm text-gray-600">Available: {usdcBalance.toFixed(2)} USDC</div>
              </div>

              <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <input
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    step="0.000001"
                    min="0"
                    className="bg-transparent text-3xl font-bold text-black placeholder-gray-500 focus:outline-none w-full"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-gray-600">USDC</span>
                    <button
                      onClick={() => setDepositAmount(usdcBalance.toString())}
                      className="px-3 py-1 bg-black/20 border border-black/50 rounded-lg text-black hover:text-orange-300 transition-colors duration-300 text-sm font-medium"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">Pool capacity</span>
                    <span className="text-black">Unlimited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Your balance</span>
                    <span className="text-black">{usdcBalance.toFixed(6)} USDC</span>
                  </div>
                </div>
              </div>
            </div>

            <LockupPeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />

            <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-black mb-4">Estimated Returns</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-gray-600 text-sm mb-1">Effective APY</div>
                  <div className="text-2xl font-bold text-black">{calculateEffectiveAPY()}%</div>
                </div>

                <div>
                  <div className="text-gray-600 text-sm mb-1">Est. yield ({selectedPeriod.label})</div>
                  <div className="text-2xl font-bold text-black">
                    {calculateEstimatedYield().toFixed(2)}
                    <span className="text-lg text-gray-600 ml-1">USDC</span>
                  </div>
                </div>
              </div>

              {selectedPeriod.multiplier > 1 && (
                <div className="bg-gradient-to-r from-black/10 to-gray-700/10 border border-black/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-black to-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-black text-xs font-bold">✦</span>
                    </div>
                    <span className="text-black font-medium">Bonus Multiplier Active</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Earn {selectedPeriod.multiplier}x rewards by locking for {selectedPeriod.label}
                  </p>
                </div>
              )}
            </div>

            <GlowingButton onClick={handleDeposit} className="w-full text-lg py-6">
              {transactionStatus === "depositing" ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Depositing to Pool...
                </>
              ) : transactionStatus === "success" ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Deposit Successful!
                </>
              ) : (
                <>
                  Stake USDC for Credit
                  <DollarSign className="w-5 h-5" />
                </>
              )}
            </GlowingButton>

            {transactionStatus === "error" && errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 backdrop-blur-sm border border-red-500/50 rounded-xl p-4 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <div className="text-red-400 font-medium">Deposit Failed</div>
                  <div className="text-red-300 text-sm">{errorMessage}</div>
                </div>
              </motion.div>
            )}

            {transactionStatus === "success" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 backdrop-blur-sm border border-green-500/50 rounded-xl p-4 flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <div className="text-green-400 font-medium">Deposit Successful!</div>
                  <div className="text-green-300 text-sm">
                    Your USDC has been deposited to the lending pool and is now earning interest.
                  </div>
                </div>
              </motion.div>
            )}

            <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Your USDC Balance:</span>
                <span className="text-black">{usdcBalance.toFixed(6)} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Connected Wallet:</span>
                <span className="text-black font-mono">
                  {account?.address
                    ? `${account.address.toString().slice(0, 6)}...${account.address.toString().slice(-4)}`
                    : ""}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Contract Address:</span>
                <span className="text-gray-500 font-mono text-xs">
                  {`${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`}
                </span>
              </div>
            </div>

            <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-blue-400 mb-1">How it works:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Your USDC is staked as collateral for crypto credit lines</li>
                    <li>• Enable crypto-backed credit without selling your assets</li>
                    <li>• Earn competitive yield while your USDC backs real-world spending</li>
                    <li>• Longer lockup periods earn higher yield multipliers</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
