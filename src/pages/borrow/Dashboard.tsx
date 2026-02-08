import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CreditCard,
  DollarSign,
  ExternalLink,
  Info,
  Loader,
  Plus,
  Shield,
  Target,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GlowingButton } from "../../components/GlowingButton";
import LoginWithGoogleButton from "../../components/LoginWithGoogleButton";
import { WalletSelector } from "../../components/WalletSelector";
import { SEO } from "../../components/SEO";
import {
  CONTRACT_ADDRESS,
  ADMIN_ADDRESS,
  getCreditLineInfo,
  getReputationData,
  checkCreditIncreaseEligibility,
  fetchUsdcBalance,
  handleTransactionError,
  usdcToUnits,
} from "../../lib/contractUtils";

type CreditSummaryCardProps = {
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
};

const CreditSummaryCard = ({ creditLimit, usedCredit, availableCredit }: CreditSummaryCardProps) => {
  const usagePercentage = creditLimit > 0 ? (usedCredit / creditLimit) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 text-center"
    >
      <div className="flex items-center justify-center gap-2 mb-4">
        <CreditCard className="w-6 h-6 text-black" />
        <h2 className="text-xl font-semibold text-black">Crypto Credit Overview</h2>
      </div>

      <div className="mb-6">
        <div className="text-5xl font-bold text-transparent bg-gradient-to-r from-black to-red-400 bg-clip-text mb-2">
          ${creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-gray-600">Total Credit Limit</div>
      </div>

      <div className="mb-6">
        <div className="text-2xl font-bold text-black mb-2">
          ${availableCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-gray-600 text-sm">Available Credit</div>
      </div>

      {/* Credit Usage Bar */}
      <div className="w-full bg-gray-300 rounded-full h-3 mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(usagePercentage, 100)}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="bg-gradient-to-r from-black to-red-500 h-3 rounded-full"
        />
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Used: ${usedCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span>{usagePercentage.toFixed(1)}% utilized</span>
      </div>
    </motion.div>
  );
};

type CollateralCardProps = {
  stakedAmount: number;
  onStakeMore: () => void;
};

const CollateralCard = ({ stakedAmount, onStakeMore }: CollateralCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="flex flex-col justify-between bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-black" />
          <h3 className="text-lg font-semibold text-black">Collateral</h3>
        </div>
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute right-0 top-6 w-64 bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            Your staked USDC acts as collateral and determines your credit limit
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-3xl font-bold text-black mb-1">
          ${stakedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-gray-600 text-sm">USDC Staked</div>
      </div>

      <GlowingButton onClick={onStakeMore} className="w-full">
        <Plus className="w-4 h-4" />
        Stake More
      </GlowingButton>
    </motion.div>
  );
};

type OutstandingLoanCardProps = {
  principal: number;
  interest: number;
  isOverdue: boolean;
  daysUntilDue: number;
  usdcBalance: number;
  onRepay: (principalAmount: number, interestAmount: number) => void;
  isRepayLoading: boolean;
};

const OutstandingLoanCard = ({
  principal,
  interest,
  isOverdue,
  daysUntilDue,
  usdcBalance,
  onRepay,
  isRepayLoading,
}: OutstandingLoanCardProps) => {
  const totalDebt = principal + interest;
  const [repayMode, setRepayMode] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState("");

  const handleRepay = () => {
    if (repayMode === "full") {
      onRepay(principal, interest);
    } else {
      const amount = parseFloat(customAmount);
      if (!amount || amount <= 0) {
        toast.error("Please enter a valid repayment amount");
        return;
      }
      if (amount > totalDebt) {
        toast.error("Amount exceeds total debt");
        return;
      }
      if (amount > usdcBalance) {
        toast.error("Insufficient USDC balance");
        return;
      }
      // Allocate: interest first, then principal
      const interestPayment = Math.min(amount, interest);
      const principalPayment = amount - interestPayment;
      onRepay(principalPayment, interestPayment);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`flex flex-col justify-between bg-gray-50/80 backdrop-blur-2xl border rounded-2xl p-6 ${
        isOverdue ? "border-red-500/50" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-black" />
          <h3 className="text-lg font-semibold text-black">Outstanding Loan</h3>
        </div>
        {totalDebt > 0 && (isOverdue || daysUntilDue <= 3) && (
          <div className="flex items-center gap-1 text-black">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{isOverdue ? "Overdue" : `${daysUntilDue} days left`}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Principal</span>
          <span className="text-black font-medium">${principal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Interest</span>
          <span className="text-black font-medium">${interest.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-300 pt-3">
          <div className="flex justify-between">
            <span className="text-black font-semibold">Total Debt</span>
            <span className="text-xl font-bold text-black">${totalDebt.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {totalDebt > 0 ? (
        <div className="space-y-3">
          {/* Repay mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setRepayMode("full")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                repayMode === "full"
                  ? "bg-black text-white"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              Full Repayment
            </button>
            <button
              onClick={() => setRepayMode("custom")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                repayMode === "custom"
                  ? "bg-black text-white"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              Custom Amount
            </button>
          </div>

          {repayMode === "custom" && (
            <div>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-gray-100 border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:border-black/50 focus:outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">
                Balance: ${usdcBalance.toFixed(2)} USDC
              </div>
            </div>
          )}

          <GlowingButton onClick={handleRepay} className="w-full" disabled={isRepayLoading}>
            {isRepayLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Processing Repayment...
              </>
            ) : (
              <>
                {repayMode === "full" ? `Repay $${totalDebt.toFixed(2)}` : "Make Repayment"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </GlowingButton>
        </div>
      ) : (
        <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/20 rounded-xl p-4 text-center">
          <div className="text-green-600 font-medium mb-1">All Paid Up!</div>
          <div className="text-green-500 text-sm">No outstanding debt</div>
        </div>
      )}
    </motion.div>
  );
};

type ReputationCardProps = {
  creditScore: number;
  potentialIncrease: number;
  tier: string;
};

const ReputationCard = ({ creditScore, potentialIncrease, tier }: ReputationCardProps) => {
  const scorePercentage = (creditScore / 1000) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="flex flex-col justify-between bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-black" />
        <h3 className="text-lg font-semibold text-black">Credit Score</h3>
      </div>

      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-transparent bg-gradient-to-r from-black to-red-400 bg-clip-text mb-2">
          {creditScore}
        </div>
        <div className="text-gray-600 text-sm">{tier} Tier</div>
      </div>

      {/* Score Progress Bar */}
      <div className="w-full bg-gray-300 rounded-full h-2 mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${scorePercentage}%` }}
          transition={{ duration: 1, delay: 0.8 }}
          className="bg-gradient-to-r from-black to-red-500 h-2 rounded-full"
        />
      </div>

      {potentialIncrease > 0 && (
        <div className="text-center mb-4">
          <div className="text-sm text-gray-600 mb-1">Potential Credit Increase</div>
          <div className="text-lg font-semibold text-black">
            +${potentialIncrease.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const getTierName = (tier: number): string => {
  switch (tier) {
    case 0: return "Bronze";
    case 1: return "Silver";
    case 2: return "Gold";
    case 3: return "Platinum";
    default: return "Bronze";
  }
};

export default function BorrowerDashboard() {
  const navigate = useNavigate();
  const { account, connected, signAndSubmitTransaction } = useWallet();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repayLoading, setRepayLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);

  // Real contract data
  const [creditData, setCreditData] = useState<{
    creditLimit: number;
    currentDebt: number;
    borrowed: number;
    interestAccrued: number;
    availableCredit: number;
    collateral: number;
    isActive: boolean;
    repaymentDueDate: number;
    totalRepaid: number;
  } | null>(null);

  const [reputationData, setReputationData] = useState<{
    score: number;
    tier: number;
    onTimeRepayments: number;
    lateRepayments: number;
    totalRepayments: number;
  } | null>(null);

  const [potentialIncrease, setPotentialIncrease] = useState(0);

  const loadDashboardData = useCallback(async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      const userAddress = account.address.toString();

      const [creditInfo, reputation, eligibility, balance] = await Promise.all([
        getCreditLineInfo(userAddress),
        getReputationData(userAddress).catch(() => null),
        checkCreditIncreaseEligibility(userAddress).catch(() => null),
        fetchUsdcBalance(userAddress),
      ]);

      if (creditInfo) {
        setCreditData(creditInfo);
      }

      if (reputation) {
        setReputationData({
          score: reputation.score,
          tier: reputation.tier,
          onTimeRepayments: reputation.onTimeRepayments,
          lateRepayments: reputation.lateRepayments,
          totalRepayments: reputation.totalRepayments,
        });
      }

      if (eligibility?.eligible) {
        setPotentialIncrease(eligibility.newLimit - (creditInfo?.creditLimit || 0));
      }

      setUsdcBalance(balance);
    } catch (err: any) {
      console.error("Error loading dashboard:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    if (connected && account?.address) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [connected, account?.address, loadDashboardData]);

  const handleStakeMore = () => {
    navigate("/borrow/stake");
  };

  const handleRepay = async (principalAmount: number, interestAmount: number) => {
    if (!account?.address) return;
    if (principalAmount <= 0 && interestAmount <= 0) return;

    const totalRepayment = principalAmount + interestAmount;
    if (totalRepayment > usdcBalance) {
      toast.error(`Insufficient USDC balance. You have $${usdcBalance.toFixed(2)} but need $${totalRepayment.toFixed(2)}`);
      return;
    }

    try {
      setRepayLoading(true);
      toast.loading("Processing repayment...", { id: "repay" });

      const payload: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::credit_manager::repay`,
          functionArguments: [
            ADMIN_ADDRESS,
            usdcToUnits(principalAmount),
            usdcToUnits(interestAmount),
          ],
        },
      };

      const result = await signAndSubmitTransaction(payload);
      console.log("Repayment result:", result);

      toast.success(`Repaid $${totalRepayment.toFixed(2)} USDC successfully!`, { id: "repay" });

      // Refresh data
      await loadDashboardData();
    } catch (err: any) {
      console.error("Repayment error:", err);
      const errorMsg = handleTransactionError(err);
      toast.error(errorMsg, { id: "repay" });
    } finally {
      setRepayLoading(false);
    }
  };

  // Calculate days until due
  const getDaysUntilDue = (): number => {
    if (!creditData?.repaymentDueDate || creditData.repaymentDueDate === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    const diff = creditData.repaymentDueDate - now;
    return Math.ceil(diff / (60 * 60 * 24));
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 text-center"
          >
            <Loader className="w-12 h-12 text-black mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-black mb-2">Loading Dashboard...</h2>
            <p className="text-gray-600">Fetching your credit information</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-red-500/50 rounded-2xl p-8 text-center"
          >
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-black mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <GlowingButton onClick={loadDashboardData} className="text-lg px-8 py-4">
              Try Again
              <ArrowRight className="w-5 h-5" />
            </GlowingButton>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show connect wallet state
  if (!connected) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 text-center"
          >
            <Wallet className="w-16 h-16 text-black mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-black mb-4">Connect to View Dashboard</h2>
            <p className="text-gray-600 mb-6">Connect your wallet to access your borrower dashboard and manage your credit</p>
            <div className="w-full flex flex-row gap-2 justify-center">
              <WalletSelector />
              <LoginWithGoogleButton />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const daysUntilDue = getDaysUntilDue();
  const isOverdue = creditData?.borrowed ? daysUntilDue < 0 : false;

  return (
    <div className="min-h-screen bg-white text-black pt-20">
      <SEO
        title="Crypto Credit Dashboard | Manage Your USDC Credit Line | Aion"
        description="Manage your crypto-backed credit line dashboard. View USDC collateral, outstanding loans, credit utilization, and make repayments. Monitor your crypto credit score and available spending power."
        keywords="crypto credit dashboard, USDC credit line, crypto collateral management, crypto credit score, crypto backed loan dashboard, stablecoin credit management, crypto credit utilization, yield earning collateral"
        ogTitle="Crypto Credit Dashboard - Manage Your Digital Asset Credit"
        ogDescription="Complete dashboard for managing your crypto-backed credit. Track USDC collateral, monitor credit utilization, view outstanding loans, and optimize your crypto credit score."
        twitterTitle="Crypto Credit Dashboard | USDC Collateral Management"
        twitterDescription="Manage your crypto credit line with real-time dashboard. Track USDC collateral, credit utilization, and earn yield while maintaining spending power."
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
            Your Crypto Credit Dashboard
          </h1>
        </motion.div>

        {/* Show different content based on whether user has an active credit line */}
        {!creditData?.isActive ? (
          // No active credit line - show call to action
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 text-center"
          >
            <CreditCard className="w-16 h-16 text-black mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-black mb-4">No Active Crypto Credit Line</h2>
            <p className="text-gray-600 mb-6">
              Stake your USDC as collateral to unlock crypto-backed credit and start spending crypto without selling your assets
            </p>
            <GlowingButton onClick={handleStakeMore} className="text-lg px-8 py-4">
              Stake USDC & Get Crypto Credit
              <ArrowRight className="w-5 h-5" />
            </GlowingButton>
          </motion.div>
        ) : (
          // Active credit line - show dashboard
          <>
            {/* Credit Summary - Full Width */}
            <div className="mb-8">
              <CreditSummaryCard
                creditLimit={creditData.creditLimit}
                usedCredit={creditData.currentDebt}
                availableCredit={creditData.availableCredit}
              />
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <CollateralCard stakedAmount={creditData.collateral} onStakeMore={handleStakeMore} />

              <OutstandingLoanCard
                principal={creditData.borrowed}
                interest={creditData.interestAccrued}
                isOverdue={isOverdue}
                daysUntilDue={Math.abs(daysUntilDue)}
                usdcBalance={usdcBalance}
                onRepay={handleRepay}
                isRepayLoading={repayLoading}
              />

              <ReputationCard
                creditScore={reputationData?.score ?? 500}
                potentialIncrease={potentialIncrease}
                tier={getTierName(reputationData?.tier ?? 0)}
              />
            </div>

            {/* Repayment Summary */}
            {creditData.totalRepaid > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6 mb-8"
              >
                <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Repayment Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Total Repaid</div>
                    <div className="text-black font-semibold text-lg">${creditData.totalRepaid.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">On-Time Payments</div>
                    <div className="text-green-600 font-semibold text-lg">{reputationData?.onTimeRepayments ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Late Payments</div>
                    <div className="text-red-500 font-semibold text-lg">{reputationData?.lateRepayments ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">USDC Balance</div>
                    <div className="text-black font-semibold text-lg">${usdcBalance.toFixed(2)}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Contract Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <ExternalLink className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-600 mb-1">Credit Manager Contract</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{CONTRACT_ADDRESS}</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
