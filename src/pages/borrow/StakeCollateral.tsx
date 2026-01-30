import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, CreditCard, DollarSign, Info, Loader, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GlowingButton } from "../../components/GlowingButton";
import LoginWithGoogleButton from "../../components/LoginWithGoogleButton";
import { WalletSelector } from "../../components/WalletSelector";
import {
  ADMIN_ADDRESS,
  CONTRACT_ADDRESS,
  fetchUsdcBalance,
  getCreditLineInfo as getCreditLineInfoFromLib,
  handleTransactionError,
  usdcToUnits,
  validateUsdcAmount,
} from "../../lib/contractUtils";

type CreditLineInfo = {
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  isActive: boolean;
  lastBorrowTimestamp: number;
  collateralAmount?: number;
  collateral?: number;
};

export default function StakeCollateral() {
  const navigate = useNavigate();
  const { account, connected, signAndSubmitTransaction } = useWallet();

  const [stakeAmount, setStakeAmount] = useState("");
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "approving" | "staking" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [creditLineInfo, setCreditLineInfo] = useState<CreditLineInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const getUsdcBalance = async () => {
    if (!account?.address) return;

    try {
      const balance = await fetchUsdcBalance(account.address.toString());
      setUsdcBalance(balance);
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcBalance(0);
    }
  };

  const getCreditLineInfo = async (): Promise<CreditLineInfo | null> => {
    if (!account?.address) return null;

    try {
      console.log(`Fetching credit line info for ${account.address.toString()}`);

      // Use the updated getCreditLineInfo function
      const creditInfo = await getCreditLineInfoFromLib(account.address.toString());

      if (creditInfo) {
        return {
          creditLimit: creditInfo.creditLimit,
          currentDebt: creditInfo.currentDebt,
          availableCredit: creditInfo.availableCredit,
          isActive: creditInfo.isActive,
          lastBorrowTimestamp: creditInfo.lastBorrowTimestamp,
          collateralAmount: creditInfo.collateral,
        };
      }

      return null;
    } catch (error: any) {
      console.error("Error fetching credit line info:", error);
      return null;
    }
  };

  const openCreditLine = async (creditLimitUsdc: number) => {
    if (!account?.address) throw new Error("Wallet not connected");

    if (!validateUsdcAmount(creditLimitUsdc)) {
      throw new Error("Invalid credit limit amount");
    }

    const payload: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDRESS}::credit_manager::open_credit_line`,
        functionArguments: [ADMIN_ADDRESS, usdcToUnits(creditLimitUsdc)],
      },
    };

    console.log("Open credit line payload:", payload);
    return await signAndSubmitTransaction(payload);
  };

  const addCollateral = async (collateralAmountUsdc: number) => {
    if (!account?.address) throw new Error("Wallet not connected");

    if (!validateUsdcAmount(collateralAmountUsdc)) {
      throw new Error("Invalid collateral amount");
    }

    const payload: InputTransactionData = {
      data: {
        function: `${CONTRACT_ADDRESS}::credit_manager::add_collateral`,
        functionArguments: [ADMIN_ADDRESS, usdcToUnits(collateralAmountUsdc)],
      },
    };

    console.log("Add collateral payload:", payload);
    return await signAndSubmitTransaction(payload);
  };

  const handleOpenCreditLine = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0 || !account?.address) return;

    try {
      setTransactionStatus("staking");
      setErrorMessage("");

      const amount = parseFloat(stakeAmount);

      if (!validateUsdcAmount(amount)) {
        throw new Error("Invalid credit limit amount. Please enter a value between 0 and 1,000,000 USDC");
      }

      if (amount > usdcBalance) {
        throw new Error("Insufficient USDC balance");
      }

      toast.loading("Opening credit line...", { id: "stake" });

      const result = await openCreditLine(amount);

      console.log("Credit line opened:", result);

      toast.success(`Successfully opened credit line with $${amount.toFixed(2)} USDC limit!`, {
        id: "stake",
      });

      setTransactionStatus("success");
      setStakeAmount("");

      // Navigate to payments page after successful credit line opening
      setTimeout(() => navigate("/borrow"), 2000);

      await loadData();

      setTimeout(() => setTransactionStatus("idle"), 3000);
    } catch (error: any) {
      console.error("Credit line opening error:", error);
      const userFriendlyError = handleTransactionError(error);
      setErrorMessage(userFriendlyError);
      setTransactionStatus("error");

      toast.error(userFriendlyError, { id: "stake" });

      setTimeout(() => {
        setTransactionStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  const handleAddCollateral = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0 || !account?.address) return;

    try {
      setTransactionStatus("staking");
      setErrorMessage("");

      const amount = parseFloat(stakeAmount);

      if (!validateUsdcAmount(amount)) {
        throw new Error("Invalid collateral amount. Please enter a value between 0 and 1,000,000 USDC");
      }

      if (amount > usdcBalance) {
        throw new Error("Insufficient USDC balance");
      }

      toast.loading("Adding collateral...", { id: "stake" });

      const result = await addCollateral(amount);

      console.log("Collateral added:", result);

      toast.success(`Successfully added ${amount} USDC collateral!`, {
        id: "stake",
      });

      setTransactionStatus("success");
      setStakeAmount("");

      await loadData();

      setTimeout(() => setTransactionStatus("idle"), 3000);
    } catch (error: any) {
      console.error("Add collateral error:", error);
      const userFriendlyError = handleTransactionError(error);
      setErrorMessage(userFriendlyError);
      setTransactionStatus("error");

      toast.error(userFriendlyError, { id: "stake" });

      setTimeout(() => {
        setTransactionStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  const handleStake = () => {
    if (!connected || !account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (creditLineInfo && creditLineInfo.isActive) {
      handleAddCollateral();
    } else {
      handleOpenCreditLine();
    }
  };

  const loadData = async () => {
    if (!connected || !account?.address) return;

    setLoading(true);
    try {
      // Get USDC balance first
      await getUsdcBalance();

      // Then try to get credit line info - this might be null for new users
      const creditInfo = await getCreditLineInfo();

      setCreditLineInfo(creditInfo);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected && account?.address) {
      loadData();
    }
  }, [connected, account?.address]);

  const calculateCreditLimit = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return 0;
    return parseFloat(stakeAmount) * 1.0;
  };

  const isValidAmount = stakeAmount && parseFloat(stakeAmount) > 0 && parseFloat(stakeAmount) <= usdcBalance;
  const isLoading = transactionStatus === "approving" || transactionStatus === "staking";
  const canStake = connected && isValidAmount && !isLoading;

  const hasExistingCredit = creditLineInfo && creditLineInfo.isActive;

  if (!connected) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8"
          >
            <div className="text-center mb-8">
              <CreditCard className="w-16 h-16 text-black mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-black mb-4">Connect Wallet to Continue</h2>
              <p className="text-gray-600">Connect your wallet to stake collateral and open a credit line</p>
            </div>

            <div className="space-y-4">
              <WalletSelector />
              <LoginWithGoogleButton />
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">Secure connection to manage your credit line</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

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
            <h2 className="text-xl font-bold text-black mb-2">Loading Credit Information...</h2>
            <p className="text-gray-600">Fetching your credit line status</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Wallet Info */}
      <div className="flex items-center gap-4 w-full justify-end p-4">
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Wallet className="w-4 h-4 text-black" />
            <span className="font-mono">
              {account?.address
                ? `${account.address.toString().slice(0, 6)}...${account.address.toString().slice(-4)}`
                : ""}
            </span>
          </div>
          <div className="text-xs text-gray-500">Aptos Wallet</div>
        </div>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-clip-text text-transparent">
            {hasExistingCredit ? "Add More Collateral" : "Stake USDC as Collateral"}
          </h1>
          <p className="text-gray-600 text-lg">
            {hasExistingCredit
              ? "Increase your credit limit by adding more USDC collateral"
              : "Stake USDC to open your credit line and start borrowing"}
          </p>
        </motion.div>

        {/* Current Credit Line Info */}
        {hasExistingCredit && creditLineInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-6 mb-8"
          >
            <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-black" />
              Current Credit Line
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-600 text-sm">Credit Limit</div>
                <div className="text-xl font-bold text-black">${creditLineInfo.creditLimit.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Available Credit</div>
                <div className="text-xl font-bold text-green-400">${creditLineInfo.availableCredit.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Current Debt</div>
                <div className="text-xl font-bold text-red-400">${creditLineInfo.currentDebt.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Status</div>
                <div className="text-xl font-bold text-green-400">
                  {creditLineInfo.isActive ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gray-50/80 backdrop-blur-2xl border border-gray-200 rounded-2xl p-8"
        >
          <div className="mb-8">
            <div className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6 focus-within:border-black/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <input
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.000001"
                  min="0"
                  className="bg-transparent text-4xl font-bold text-black placeholder-gray-500 focus:outline-none w-full"
                />
                <div className="flex items-center gap-3">
                  <span className="text-xl text-gray-600">USDC</span>
                  <button
                    onClick={() => setStakeAmount(usdcBalance.toString())}
                    className="px-3 py-1 bg-gray-200/80 backdrop-blur-sm border border-gray-400 rounded-lg text-black hover:text-gray-700 transition-colors duration-300 text-sm font-medium"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 px-2">
              <span className="text-gray-600 text-sm">Balance: {usdcBalance.toFixed(2)} USDC</span>
            </div>
          </div>

          {/* Credit Limit Preview */}
          {stakeAmount && parseFloat(stakeAmount) > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-100/80 backdrop-blur-sm border border-gray-300 rounded-xl p-6 mb-8"
            >
              <div className="text-center">
                <div className="text-gray-600 text-sm mb-2">
                  {hasExistingCredit ? "Additional Credit Limit" : "Credit Limit"}
                </div>
                <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-black to-red-400 bg-clip-text">
                  ${calculateCreditLimit().toFixed(2)}
                </div>
                {hasExistingCredit && creditLineInfo && (
                  <div className="mt-2 text-gray-600 text-sm">
                    New Total: ${(creditLineInfo.creditLimit + calculateCreditLimit()).toFixed(2)}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div className="text-center text-gray-600 text-sm mb-8 leading-relaxed">
            {hasExistingCredit
              ? "Adding more USDC will increase your credit limit at a 1:1 ratio."
              : "Your staked USDC secures your credit line at a 1:1 ratio (100% collateral backing)."}
          </div>

          <GlowingButton onClick={handleStake} className="w-full text-xl py-6" disabled={!canStake}>
            {transactionStatus === "staking" ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                {hasExistingCredit ? "Adding Collateral..." : "Opening Credit Line..."}
              </>
            ) : transactionStatus === "success" ? (
              <>
                <CheckCircle className="w-6 h-6" />
                {hasExistingCredit ? "Collateral Added!" : "Credit Line Opened!"}
              </>
            ) : hasExistingCredit ? (
              <>
                <Plus className="w-6 h-6" />
                Add Collateral
              </>
            ) : (
              <>
                <DollarSign className="w-6 h-6" />
                Open Credit Line
              </>
            )}
          </GlowingButton>

          {/* Transaction Status Messages */}
          {transactionStatus === "error" && errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 backdrop-blur-sm border border-red-500/50 rounded-xl p-4 flex items-center gap-3 mt-6"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <div className="text-red-400 font-medium">Transaction Failed</div>
                <div className="text-red-300 text-sm">{errorMessage}</div>
              </div>
            </motion.div>
          )}

          {transactionStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 backdrop-blur-sm border border-green-500/50 rounded-xl p-4 flex items-center gap-3 mt-6"
            >
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <div className="text-green-400 font-medium">
                  {hasExistingCredit ? "Collateral Added Successfully!" : "Credit Line Opened!"}
                </div>
                <div className="text-green-300 text-sm">
                  {hasExistingCredit
                    ? "Your credit limit has been increased."
                    : "You can now start borrowing against your collateral. Set up instant payments for the best experience!"}
                </div>
              </div>
            </motion.div>
          )}

          {/* Contract Info */}
          <div className="mt-6 p-4 bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-400 mb-1">How it works:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Your USDC is locked as collateral in the smart contract</li>
                  <li>• Credit limit equals collateral amount (1:1 ratio)</li>
                  <li>• You can borrow up to your credit limit</li>
                  <li>• Add more collateral anytime to increase your limit</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
