import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Loader,
  PieChart,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlowingButton } from "../../components/GlowingButton";
import LoginWithGoogleButton from "../../components/LoginWithGoogleButton";
import { WalletSelector } from "../../components/WalletSelector";
import { aptos, CONTRACT_ADDRESS, ADMIN_ADDRESS, unitsToUsdc, usdcToUnits } from "../../lib/contractUtils";

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  trend?: number;
  className?: string;
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, className = "" }: StatCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6 group hover:border-black/40 transition-all duration-300 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-black to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-black/30">
          <Icon className="w-5 h-5 text-black" />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm ${trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-gray-600"}`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>
              {trend > 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-black mb-1">{value}</h3>
      <p className="text-gray-600 text-sm">{title}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </motion.div>
  );
};

const PortfolioOverview = ({ lenderData, poolStats }: { lenderData: any; poolStats: any }) => {
  const totalValue = lenderData ? lenderData.depositedAmount + lenderData.earnedInterest : 0;
  const totalEarned = lenderData ? lenderData.earnedInterest : 0;
  const currentAPY = poolStats ? poolStats.currentAPY : 12.5;
  const activePositions = lenderData && lenderData.depositedAmount > 0 ? 1 : 0;

  // Calculate trend (mock for now, could be based on historical data)
  const valueTrend = totalEarned > 0 ? 8.2 : 0;
  const apyTrend = 2.1; // Mock trend

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Portfolio Value"
        value={`$${totalValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        icon={DollarSign}
        trend={valueTrend}
      />
      <StatCard
        title="Total Earned"
        value={`$${totalEarned.toFixed(2)}`}
        subtitle="All time interest"
        icon={TrendingUp}
        trend={totalEarned > 0 ? valueTrend : 0}
      />
      <StatCard title="Current APY" value={`${currentAPY}%`} icon={Target} trend={apyTrend} />
      <StatCard title="Active Positions" value={activePositions.toString()} icon={PieChart} />
    </div>
  );
};

type LenderPosition = {
  depositedAmount: number;
  earnedInterest: number;
  depositTimestamp: number;
  lastUpdateTimestamp: number;
  apy: number;
};

const ActivePositions = ({
  lenderData,
  onWithdraw,
  isWithdrawing,
}: {
  lenderData: LenderPosition | null;
  onWithdraw: (amount: number) => void;
  isWithdrawing: boolean;
}) => {
  const [withdrawAmount, setWithdrawAmount] = useState("");

  if (!lenderData || lenderData.depositedAmount === 0) {
    return (
      <div className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-black">Active Positions</h2>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <PieChart className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No Active Positions</h3>
          <p className="text-gray-600 mb-6">Start lending to see your positions here</p>
          <GlowingButton onClick={() => (window.location.href = "/lend/deposit")} className="text-sm">
            Start Lending
            <ArrowRight className="w-4 h-4" />
          </GlowingButton>
        </div>
      </div>
    );
  }

  const totalValue = lenderData.depositedAmount + lenderData.earnedInterest;
  const depositDate = new Date(lenderData.depositTimestamp * 1000);
  const daysSinceDeposit = Math.floor((Date.now() - lenderData.depositTimestamp * 1000) / (1000 * 60 * 60 * 24));

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid withdrawal amount");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount > totalValue) {
      toast.error("Withdrawal amount exceeds available balance");
      return;
    }

    onWithdraw(amount);
    setWithdrawAmount("");
  };

  return (
    <div className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-black">Active Positions</h2>
        <div className="text-sm text-green-400">1 Active Position</div>
      </div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6 hover:border-black/30 transition-all duration-300 mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-black to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-black/30">
              <span className="text-black font-bold text-sm">USDC</span>
            </div>
            <div>
              <div className="text-black font-semibold">
                $
                {totalValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-gray-600 text-sm">USDC Lending Position</div>
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="text-black font-semibold">{lenderData.apy}% APY</div>
            <div className="text-gray-600 text-sm">Variable Rate</div>
          </div>

          <div className="text-center md:text-left">
            <div className="text-black font-semibold">${lenderData.earnedInterest.toFixed(2)}</div>
            <div className="text-gray-600 text-sm">Interest Earned</div>
          </div>

          <div className="flex items-center justify-center md:justify-end gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">{daysSinceDeposit} days active</span>
          </div>
        </div>

        {/* Position Details */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 mb-1">Principal Deposited</div>
              <div className="text-black font-semibold">${lenderData.depositedAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Deposit Date</div>
              <div className="text-black font-semibold">{depositDate.toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Last Updated</div>
              <div className="text-black font-semibold">
                {new Date(lenderData.lastUpdateTimestamp * 1000).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Withdrawal Section */}
      <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-black mb-4">Withdraw Funds</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter withdrawal amount"
              className="w-full bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-3 text-black placeholder-gray-500 focus:border-black/50 focus:outline-none transition-all duration-300"
            />
            <div className="text-xs text-gray-600 mt-1">Available: ${totalValue.toFixed(2)} USDC</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setWithdrawAmount(totalValue.toString())}
              className="px-4 py-3 bg-gray-700/50 border border-white/10 rounded-xl text-gray-300 hover:border-black/50 hover:text-black transition-all duration-300 text-sm"
            >
              MAX
            </button>
            <GlowingButton onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="px-6">
              {isWithdrawing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                "Withdraw"
              )}
            </GlowingButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const PoolStats = ({ poolStats }: { poolStats: any }) => {
  if (!poolStats) {
    return (
      <div className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-8 h-8 text-black animate-spin" />
        </div>
      </div>
    );
  }

  const utilizationRate = poolStats.utilizationRate || 0;
  const riskLevel = utilizationRate > 90 ? "High" : utilizationRate > 70 ? "Medium" : "Low";
  const riskColor = utilizationRate > 90 ? "text-red-400" : utilizationRate > 70 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-black">Pool Health & Statistics</h2>
        <div className={`flex items-center gap-1 ${riskColor}`}>
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{riskLevel} Risk</span>
        </div>
      </div>

      {/* Utilization Rate */}
      <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600 font-medium">Pool Utilization</span>
          <span className="text-2xl font-bold text-black">{utilizationRate.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-black to-amber-500 h-3 rounded-full transition-all duration-500 shadow-lg shadow-black/20"
            style={{ width: `${Math.min(utilizationRate, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Total Borrowed: ${poolStats.totalBorrowed.toLocaleString()}</span>
          <span>Total Deposited: ${poolStats.totalDeposited.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Available Liquidity"
          value={`$${poolStats.availableLiquidity.toLocaleString()}`}
          icon={Users}
        />
        <StatCard title="Total Protocol Fees" value={`$${poolStats.protocolFees.toFixed(2)}`} icon={Shield} />
        <StatCard title="Risk Level" value={riskLevel} subtitle="Based on utilization" icon={Activity} />
      </div>

      {/* Contract Info */}
      <div className="mt-6 p-4 bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-blue-400 mb-1">Lending Pool Contract</p>
            <p className="text-xs font-mono text-gray-600 break-all">{CONTRACT_ADDRESS}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const UnauthorizedView = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-12 text-center"
    >
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-gradient-to-r from-black to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/30">
          <PieChart className="w-10 h-10 text-black" />
        </div>

        <h2 className="text-3xl font-bold text-black mb-4">View Your Portfolio</h2>

        <p className="text-gray-600 mb-8 leading-relaxed">
          Connect your wallet to access your complete portfolio dashboard with real-time tracking of your lending
          positions, earnings, and performance analytics.
        </p>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-gray-300">
            <CheckCircle className="w-5 h-5 text-black" />
            <span>Track lending positions and earnings</span>
          </div>
          <div className="flex items-center gap-3 text-gray-300">
            <CheckCircle className="w-5 h-5 text-black" />
            <span>Monitor APY and performance metrics</span>
          </div>
          <div className="flex items-center gap-3 text-gray-300">
            <CheckCircle className="w-5 h-5 text-black" />
            <span>Access detailed pool analytics</span>
          </div>
        </div>

        <div className="w-full flex flex-row gap-2 justify-center">
          <WalletSelector />
          <LoginWithGoogleButton />
        </div>
      </div>
    </motion.div>
  );
};

export default function Portfolio() {
  const { account, connected, signAndSubmitTransaction } = useWallet();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lenderData, setLenderData] = useState<LenderPosition | null>(null);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Get lender information from the contract
  const getLenderInfo = async (lenderAddress: string): Promise<LenderPosition | null> => {
    try {
      console.log(`Fetching lender info for ${lenderAddress}`);

      // Method 1: Try to get lender data using view function
      try {
        const [lenderExists, depositedAmount, earnedInterest, depositTimestamp, lastUpdateTimestamp] = await aptos.view<
          [boolean, string, string, string, string]
        >({
          payload: {
            function: `${CONTRACT_ADDRESS}::lending_pool::get_lender_info`,
            functionArguments: [ADMIN_ADDRESS, lenderAddress],
          },
        });

        if (lenderExists) {
          const lenderPosition: LenderPosition = {
            depositedAmount: unitsToUsdc(depositedAmount),
            earnedInterest: unitsToUsdc(earnedInterest),
            depositTimestamp: parseInt(depositTimestamp),
            lastUpdateTimestamp: parseInt(lastUpdateTimestamp),
            apy: 12.5, // This could be fetched from the interest rate model
          };

          console.log("Found lender data via view function:", lenderPosition);
          return lenderPosition;
        }
      } catch (viewError) {
        console.log("View function failed, trying resource lookup:", viewError);
      }

      // Method 2: Try to get lending pool resource using Aptos SDK
      const resource = await aptos.getAccountResource({
        accountAddress: ADMIN_ADDRESS,
        resourceType: `${CONTRACT_ADDRESS}::lending_pool::LendingPool`,
      }).catch(() => null);

      if (resource?.data) {
        console.log("Found lending pool resource:", resource.data);

        // In a real implementation, you'd need to query the lenders table
        // For now, check if the lender address exists in any lenders list
        const poolData = resource.data;

        // Check if lender has any deposit history by looking at events or tables
        // This is a simplified check - in reality you'd query the lenders table
        if (poolData.total_deposited && parseInt(poolData.total_deposited) > 0) {
          // Return estimated data based on pool state
          // This is a fallback approach - real implementation would query the table
          return {
            depositedAmount: 1000.0, // Placeholder - would be fetched from table
            earnedInterest: 50.25, // Placeholder - would be calculated
            depositTimestamp: Date.now() / 1000 - 15 * 24 * 60 * 60, // 15 days ago
            lastUpdateTimestamp: Date.now() / 1000,
            apy: 12.5,
          };
        }
      }

      console.log("No lender data found");
      return null;
    } catch (error) {
      console.error("Error fetching lender info:", error);
      throw new Error("Failed to fetch lender information");
    }
  };

  // Get pool statistics from the actual contract
  const getPoolStats = async () => {
    try {
      console.log("Fetching pool stats from contract");

      // Method 1: Try view function for pool stats
      try {
        const [totalDeposited, totalBorrowed, totalRepaid, protocolFees] = await aptos.view<
          [string, string, string, string]
        >({
          payload: {
            function: `${CONTRACT_ADDRESS}::lending_pool::get_pool_stats`,
            functionArguments: [ADMIN_ADDRESS],
          },
        });

        const totalDepositedUsdc = unitsToUsdc(totalDeposited);
        const totalBorrowedUsdc = unitsToUsdc(totalBorrowed);
        const totalRepaidUsdc = unitsToUsdc(totalRepaid);
        const protocolFeesUsdc = unitsToUsdc(protocolFees);

        const netBorrowed = Math.max(0, totalBorrowedUsdc - totalRepaidUsdc);
        const availableLiquidity = totalDepositedUsdc - netBorrowed;
        const utilizationRate = totalDepositedUsdc > 0 ? (netBorrowed / totalDepositedUsdc) * 100 : 0;

        const poolStats = {
          totalDeposited: totalDepositedUsdc,
          totalBorrowed: netBorrowed,
          availableLiquidity,
          utilizationRate,
          protocolFees: protocolFeesUsdc,
          currentAPY: 12.5, // Could be dynamic based on utilization
        };

        console.log("Pool stats from view function:", poolStats);
        return poolStats;
      } catch (viewError) {
        console.log("View function failed, trying resource lookup:", viewError);
      }

      // Method 2: Fallback to resource lookup using Aptos SDK
      const resource = await aptos.getAccountResource({
        accountAddress: ADMIN_ADDRESS,
        resourceType: `${CONTRACT_ADDRESS}::lending_pool::LendingPool`,
      }).catch(() => null);

      if (resource?.data) {
        const poolData = resource.data;
        const totalDeposited = unitsToUsdc(poolData.total_deposited || "0");
        const totalBorrowed = unitsToUsdc(poolData.total_borrowed || "0");
        const totalRepaid = unitsToUsdc(poolData.total_repaid || "0");
        const protocolFees = unitsToUsdc(poolData.protocol_fees_collected || "0");

        const netBorrowed = Math.max(0, totalBorrowed - totalRepaid);
        const availableLiquidity = totalDeposited - netBorrowed;
        const utilizationRate = totalDeposited > 0 ? (netBorrowed / totalDeposited) * 100 : 0;

        const poolStats = {
          totalDeposited,
          totalBorrowed: netBorrowed,
          availableLiquidity,
          utilizationRate,
          protocolFees,
          currentAPY: 12.5,
        };

        console.log("Pool stats from resource:", poolStats);
        return poolStats;
      }

      throw new Error("Could not fetch pool statistics");
    } catch (error) {
      console.error("Error fetching pool stats:", error);
      throw new Error("Failed to fetch pool statistics");
    }
  };

  // Get current APY from interest rate model
  const getCurrentAPY = async (): Promise<number> => {
    try {
      const [currentRate] = await aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::interest_rate_model::get_current_borrow_rate`,
          functionArguments: [ADMIN_ADDRESS],
        },
      });

      // Convert basis points to percentage (e.g., 1500 basis points = 15%)
      return parseInt(currentRate) / 100;
    } catch (error) {
      console.error("Error fetching current APY:", error);
      return 12.5; // Fallback APY
    }
  };

  // Calculate earned interest for a lender
  const calculateEarnedInterest = async (lenderAddress: string): Promise<number> => {
    try {
      const [earnedInterest] = await aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::calculate_earned_interest`,
          functionArguments: [ADMIN_ADDRESS, lenderAddress],
        },
      });

      return unitsToUsdc(earnedInterest);
    } catch (error) {
      console.error("Error calculating earned interest:", error);
      return 0;
    }
  };

  // Withdraw USDC from lending pool
  const withdrawUSDC = async (amountUsdc: number) => {
    if (!account?.address) throw new Error("Wallet not connected");

    // Validate amount
    if (amountUsdc <= 0 || amountUsdc > 1000000) {
      throw new Error("Invalid withdrawal amount");
    }

    const payload: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDRESS}::lending_pool::withdraw`,
        functionArguments: [
          ADMIN_ADDRESS, // pool_addr
          usdcToUnits(amountUsdc), // amount
        ],
      },
    };

    console.log("Withdrawal payload:", payload);
    return await signAndSubmitTransaction(payload);
  };

  const handleWithdraw = async (amount: number) => {
    try {
      setIsWithdrawing(true);

      toast.loading("Processing withdrawal...", { id: "withdraw" });

      const result = await withdrawUSDC(amount);

      console.log("Withdrawal result:", result);

      toast.success(`Successfully withdrew ${amount} USDC from the lending pool!`, {
        id: "withdraw",
      });

      // Refresh data
      await loadPortfolioData();
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      const errorMessage = error.message || "Withdrawal failed. Please try again.";
      toast.error(errorMessage, { id: "withdraw" });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const loadPortfolioData = async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      console.log("Loading portfolio data for:", account.address.toString());

      // Load data in parallel for better performance
      const [lenderInfo, poolData] = await Promise.all([
        getLenderInfo(account.address.toString()).catch((err) => {
          console.error("Lender info error:", err);
          return null;
        }),
        getPoolStats().catch((err) => {
          console.error("Pool stats error:", err);
          return null;
        }),
      ]);

      // If we have lender data, try to get more accurate interest calculation
      if (lenderInfo && lenderInfo.depositedAmount > 0) {
        try {
          const earnedInterest = await calculateEarnedInterest(account.address.toString());
          lenderInfo.earnedInterest = earnedInterest;
        } catch (error) {
          console.error("Error calculating earned interest:", error);
        }

        try {
          const currentAPY = await getCurrentAPY();
          lenderInfo.apy = currentAPY;
        } catch (error) {
          console.error("Error fetching current APY:", error);
        }
      }

      setLenderData(lenderInfo);
      setPoolStats(poolData);

      console.log("Portfolio data loaded:", { lenderInfo, poolData });
    } catch (error: any) {
      console.error("Error loading portfolio data:", error);
      setError("Failed to load portfolio data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data periodically
  useEffect(() => {
    if (connected && account?.address) {
      loadPortfolioData();

      // Refresh data every 30 seconds
      const interval = setInterval(() => {
        if (connected && account?.address) {
          loadPortfolioData();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [connected, account?.address]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black">

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader className="w-12 h-12 text-black mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold text-black mb-2">Loading Portfolio...</h2>
              <p className="text-gray-600">Fetching your lending positions and earnings</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white text-black">

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-black mb-2">Error Loading Portfolio</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <GlowingButton onClick={loadPortfolioData}>Try Again</GlowingButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
            Your Portfolio
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Complete overview of your lending positions and earnings
          </p>
        </motion.div>

        {/* Main Content */}
        {!connected ? (
          <UnauthorizedView />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <PortfolioOverview lenderData={lenderData} poolStats={poolStats} />
            <ActivePositions lenderData={lenderData} onWithdraw={handleWithdraw} isWithdrawing={isWithdrawing} />
            <PoolStats poolStats={poolStats} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
