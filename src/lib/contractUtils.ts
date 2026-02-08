import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0xceb67803c3af67e2031e319f021e693ead697dda75e59a7b85a7e75a1cda4d78";
export const ADMIN_ADDRESS =
  import.meta.env.VITE_ADMIN_ADDRESS || "0xceb67803c3af67e2031e319f021e693ead697dda75e59a7b85a7e75a1cda4d78";
export const USDC_METADATA = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

const config = new AptosConfig({ network: Network.MAINNET });
export const aptos = new Aptos(config);

export const usdcToUnits = (usdcAmount: number): string => {
  const amount = Math.floor(usdcAmount * 1000000);
  return amount.toString();
};

export const unitsToUsdc = (units: string | number): number => {
  const unitsNum = typeof units === "string" ? parseInt(units, 10) : units;
  return unitsNum / 1000000;
};

export const fetchUsdcBalance = async (accountAddress: string): Promise<number> => {
  try {
    const [balanceStr] = await aptos.view<[string]>({
      payload: {
        function: "0x1::primary_fungible_store::balance",
        typeArguments: ["0x1::object::ObjectCore"],
        functionArguments: [accountAddress, USDC_METADATA],
      },
    });
    const balance = parseInt(balanceStr, 10);
    return balance / 1000000;
  } catch (error) {
    try {
      const allResources = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${accountAddress}/resources`)
        .then((res) => res.json())
        .catch(() => []);
      const usdcResource = allResources.find(
        (resource: any) =>
          resource.type.includes(USDC_METADATA) ||
          (resource.type.includes("coin::CoinStore") && resource.type.toLowerCase().includes("usdc")) ||
          resource.type.includes("0x1::coin::CoinStore<0x"),
      );
      if (usdcResource) {
        const balance = parseInt(usdcResource.data.coin?.value || usdcResource.data.balance || "0");
        return balance / 1000000;
      }
      const coinStoreResponse = await fetch(
        `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${accountAddress}/resource/0x1::coin::CoinStore<${USDC_METADATA}>`,
      )
        .then((res) => res.json())
        .catch(() => null);
      if (coinStoreResponse?.data?.coin?.value) {
        return parseInt(coinStoreResponse.data.coin.value) / 1000000;
      }
    } catch (fallbackError) {
      console.error("Error fetching USDC balance:", fallbackError);
    }
    return 0;
  }
};

export const checkLenderExists = async (lenderAddress: string): Promise<boolean> => {
  try {
    const lenderInfo = await getLenderInfo(lenderAddress);
    return lenderInfo !== null && lenderInfo.depositedAmount > 0;
  } catch (error) {
    console.error("Error checking lender existence:", error);
    return false;
  }
};

export const getPoolUtilization = async (): Promise<number> => {
  try {
    const [utilizationBasisPoints] = await aptos.view<[string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_utilization_rate`,
        functionArguments: [ADMIN_ADDRESS],
      },
    });
    return parseInt(utilizationBasisPoints) / 100;
  } catch (error) {
    console.error("Error fetching pool utilization:", error);
    return 0;
  }
};

export const checkCreditLineExists = async (userAddress: string): Promise<boolean> => {
  try {
    const creditInfo = await getCreditLineInfo(userAddress);
    return creditInfo !== null && (creditInfo.isActive || creditInfo.creditLimit > 0);
  } catch (error: any) {
    return false;
  }
};

export const checkCreditIncreaseEligibility = async (
  userAddress: string,
): Promise<{
  eligible: boolean;
  newLimit: number;
} | null> => {
  try {
    console.log(`Checking credit increase eligibility for user: ${userAddress}`);

    const [eligible, newLimit] = await aptos.view<[boolean, string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::check_credit_increase_eligibility`,
        functionArguments: [ADMIN_ADDRESS, userAddress],
      },
    });

    return {
      eligible,
      newLimit: unitsToUsdc(newLimit),
    };
  } catch (error: any) {
    console.error("Error checking credit increase eligibility:", error);
    return null;
  }
};

export const getCreditLineInfo = async (
  userAddress: string,
): Promise<{
  creditLimit: number;
  currentDebt: number;
  borrowed: number;
  interestAccrued: number;
  availableCredit: number;
  isActive: boolean;
  repaymentDueDate: number;
  collateral: number;
  totalRepaid: number;
} | null> => {
  try {
    const creditManagerExists = await checkCreditManagerInitialized();
    if (!creditManagerExists) {
      return {
        creditLimit: 0,
        currentDebt: 0,
        borrowed: 0,
        interestAccrued: 0,
        availableCredit: 0,
        isActive: false,
        repaymentDueDate: 0,
        collateral: 0,
        totalRepaid: 0,
      };
    }

    // Contract returns: (initial_collateral, credit_limit, borrowed, interest, total_repaid, due_date, is_active)
    const [collateralDeposited, creditLimit, borrowedAmount, totalInterest, totalRepaid, repaymentDueDate, isActive] =
      await aptos.view<[string, string, string, string, string, string, boolean]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::credit_manager::get_credit_info`,
          functionArguments: [ADMIN_ADDRESS, userAddress],
        },
      });

    const creditLimitUsdc = unitsToUsdc(creditLimit);
    const borrowedUsdc = unitsToUsdc(borrowedAmount);
    const interestUsdc = unitsToUsdc(totalInterest);
    const currentDebtUsdc = borrowedUsdc + interestUsdc;
    const availableCredit = creditLimitUsdc - currentDebtUsdc;

    return {
      creditLimit: creditLimitUsdc,
      currentDebt: currentDebtUsdc,
      borrowed: borrowedUsdc,
      interestAccrued: interestUsdc,
      availableCredit: Math.max(0, availableCredit),
      isActive,
      repaymentDueDate: parseInt(repaymentDueDate),
      collateral: unitsToUsdc(collateralDeposited),
      totalRepaid: unitsToUsdc(totalRepaid),
    };
  } catch (error: any) {
    if (error.message?.includes("Function not found") || error.message?.includes("FUNCTION_NOT_FOUND")) {
      return {
        creditLimit: 0,
        currentDebt: 0,
        borrowed: 0,
        interestAccrued: 0,
        availableCredit: 0,
        isActive: false,
        repaymentDueDate: 0,
        collateral: 0,
        totalRepaid: 0,
      };
    }
    return null;
  }
};

export const checkCreditManagerInitialized = async (): Promise<boolean> => {
  try {
    await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::is_paused`,
        functionArguments: [ADMIN_ADDRESS],
      },
    });
    return true;
  } catch (error: any) {
    if (
      error.message?.includes("Failed to borrow global resource") ||
      error.message?.includes("resource_not_found") ||
      error.message?.includes("Resource not found")
    ) {
    } else {
    }
    return false;
  }
};

export const checkAllContractsInitialized = async (): Promise<{
  creditManager: boolean;
  lendingPool: boolean;
  reputationManager: boolean;
  fixedInterestRate: boolean;
  borrowersList: boolean;
  allInitialized: boolean;
}> => {
  const results = await Promise.allSettled([
    aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::is_paused`,
        functionArguments: [ADMIN_ADDRESS],
      },
    }),
    aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_total_deposited`,
        functionArguments: [ADMIN_ADDRESS],
      },
    }),
    aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::reputation_manager::get_user_count`,
        functionArguments: [ADMIN_ADDRESS],
      },
    }),
    aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_fixed_interest_rate`,
        functionArguments: [ADMIN_ADDRESS],
      },
    }),
    aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_all_borrowers`,
        functionArguments: [ADMIN_ADDRESS],
      },
    }),
  ]);

  const status = {
    creditManager: results[0].status === "fulfilled",
    lendingPool: results[1].status === "fulfilled",
    reputationManager: results[2].status === "fulfilled",
    fixedInterestRate: results[3].status === "fulfilled",
    borrowersList: results[4].status === "fulfilled",
    allInitialized: false,
  };

  status.allInitialized = Object.values(status).every((v) => v === true);
  return status;
};

export const getRepaymentHistory = async (
  userAddress: string,
): Promise<{
  onTimeRepayments: number;
  lateRepayments: number;
  totalRepaid: number;
} | null> => {
  try {
    const [onTimeRepayments, lateRepayments, totalRepaid] = await aptos.view<[string, string, string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_repayment_history`,
        functionArguments: [ADMIN_ADDRESS, userAddress],
      },
    });

    return {
      onTimeRepayments: parseInt(onTimeRepayments),
      lateRepayments: parseInt(lateRepayments),
      totalRepaid: unitsToUsdc(totalRepaid),
    };
  } catch (error: any) {
    console.error("Error fetching repayment history:", error);
    return null;
  }
};

export const getComprehensiveCreditInfo = async (
  userAddress: string,
): Promise<{
  creditLimit: number;
  currentDebt: number;
  totalBorrowed: number;
  totalRepaid: number;
  collateralDeposited: number;
  repaymentDueDate: number;
  isActive: boolean;
} | null> => {
  try {
    const creditInfo = await getCreditLineInfo(userAddress);

    if (creditInfo) {
      return {
        creditLimit: creditInfo.creditLimit,
        currentDebt: creditInfo.currentDebt,
        totalBorrowed: creditInfo.currentDebt + creditInfo.totalRepaid,
        totalRepaid: creditInfo.totalRepaid,
        collateralDeposited: creditInfo.collateral,
        repaymentDueDate: creditInfo.repaymentDueDate,
        isActive: creditInfo.isActive,
      };
    }

    return null;
  } catch (error: any) {
    return null;
  }
};

export const handleTransactionError = (error: any): string => {
  const errorMessage = error.message || error.toString();
  if (errorMessage.includes("EINSUFFICIENT_BALANCE")) {
    return "Insufficient USDC balance for this transaction";
  }
  if (errorMessage.includes("CREDIT_LINE_EXISTS")) {
    return "Credit line already exists for this account";
  }
  if (errorMessage.includes("INSUFFICIENT_COLLATERAL")) {
    return "Insufficient collateral for the requested credit limit";
  }
  if (errorMessage.includes("NOT_AUTHORIZED")) {
    return "Transaction not authorized. Please try again.";
  }
  if (errorMessage.includes("INVALID_AMOUNT")) {
    return "Please enter a valid amount";
  }
  if (errorMessage.includes("INSUFFICIENT_LIQUIDITY")) {
    return "Not enough liquidity in the pool. Try a smaller amount.";
  }
  if (errorMessage.includes("EXCEEDS_CREDIT_LIMIT")) {
    return "This transaction exceeds your credit limit";
  }
  return "Transaction failed. Please try again.";
};

export const formatUsdc = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
};

export const validateUsdcAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 1000000 && !isNaN(amount);
};

export const validateAptosAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
};

export const calculateAccruedInterest = (
  principalUsdc: number,
  annualRateBasisPoints: number,
  borrowTimestamp: number,
  gracePeriodSeconds: number = 2592000,
): number => {
  const currentTime = Math.floor(Date.now() / 1000);
  const graceEndTime = borrowTimestamp + gracePeriodSeconds;
  if (currentTime <= graceEndTime) {
    return 0;
  }
  const interestStartTime = graceEndTime;
  const timeElapsed = currentTime - interestStartTime;
  const secondsPerYear = 31536000;
  const rate = annualRateBasisPoints / 10000;
  const dailyRate = rate / secondsPerYear;
  return principalUsdc * dailyRate * timeElapsed;
};

/** @deprecated Pre-authorization is not available in the current contract version */
export const setupPreAuthorization = async (
  _borrowerAddress: string,
  _totalLimitUsdc: number,
  _perTxLimitUsdc: number,
  _durationHours: number,
) => {
  console.warn("setupPreAuthorization: Not available in current contract version");
  return null;
};

/** @deprecated Pre-authorization is not available in the current contract version */
export const getPreAuthStatus = async (_borrowerAddress: string) => {
  return null;
};

export const executeSignlessPayment = async (recipientAddress: string, amountUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::credit_manager::borrow_and_pay`,
    functionArguments: [ADMIN_ADDRESS, recipientAddress, usdcToUnits(amountUsdc)],
    typeArguments: [],
  };
  return payload;
};

/** @deprecated Pre-authorization is not available in the current contract version */
export const updatePreAuthLimits = async (
  _borrowerAddress: string,
  _newTotalLimitUsdc: number,
  _newPerTxLimitUsdc: number,
) => {
  console.warn("updatePreAuthLimits: Not available in current contract version");
  return null;
};

/** @deprecated Pre-authorization is not available in the current contract version */
export const togglePreAuthorization = async (_borrowerAddress: string, _enable: boolean) => {
  console.warn("togglePreAuthorization: Not available in current contract version");
  return null;
};

export const openCreditLine = async (_borrowerAddress: string, collateralAmountUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::credit_manager::open_credit_line`,
    functionArguments: [ADMIN_ADDRESS, usdcToUnits(collateralAmountUsdc)],
    typeArguments: [],
  };
  return payload;
};

export const addCollateral = async (_borrowerAddress: string, collateralAmountUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::credit_manager::add_collateral`,
    functionArguments: [ADMIN_ADDRESS, usdcToUnits(collateralAmountUsdc)],
    typeArguments: [],
  };
  return payload;
};

export const borrowFunds = async (_borrowerAddress: string, amountUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::credit_manager::borrow`,
    functionArguments: [ADMIN_ADDRESS, usdcToUnits(amountUsdc)],
    typeArguments: [],
  };
  return payload;
};

export const repayLoan = async (_borrowerAddress: string, principalUsdc: number, interestUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::credit_manager::repay`,
    functionArguments: [ADMIN_ADDRESS, usdcToUnits(principalUsdc), usdcToUnits(interestUsdc)],
    typeArguments: [],
  };
  return payload;
};

export const depositCollateral = async (borrowerAddress: string, amountUsdc: number) => {
  // Collateral is now managed through credit_manager (collateral_vault is legacy)
  return addCollateral(borrowerAddress, amountUsdc);
};

export const depositToLendingPool = async (_lenderAddress: string, amountUsdc: number) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::lending_pool::deposit`,
    functionArguments: [ADMIN_ADDRESS, usdcToUnits(amountUsdc)],
    typeArguments: [],
  };
  return payload;
};

export const initializeUserReputation = async (_userAddress: string) => {
  const payload = {
    function: `${CONTRACT_ADDRESS}::reputation_manager::initialize_user`,
    functionArguments: [ADMIN_ADDRESS],
    typeArguments: [],
  };
  return payload;
};

export const checkUserReputationInitialized = async (userAddress: string): Promise<boolean> => {
  try {
    const [isInitialized] = await aptos.view<[boolean]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::reputation_manager::is_user_initialized`,
        functionArguments: [ADMIN_ADDRESS, userAddress],
      },
    });
    return isInitialized;
  } catch (error) {
    console.error("Error checking user reputation initialization:", error);
    return false;
  }
};

export const getUserComprehensiveStatus = async (
  userAddress: string,
): Promise<{
  hasReputation: boolean;
  hasCreditLine: boolean;
  creditInfo: {
    creditLimit: number;
    currentDebt: number;
    availableCredit: number;
    isActive: boolean;
    repaymentDueDate: number;
    collateral: number;
    totalRepaid: number;
  } | null;
  usdcBalance: number;
} | null> => {
  try {
    const [hasReputation, creditInfo, usdcBalance] = await Promise.all([
      checkUserReputationInitialized(userAddress),
      getCreditLineInfo(userAddress),
      fetchUsdcBalance(userAddress),
    ]);
    return {
      hasReputation,
      hasCreditLine: !!(creditInfo && creditInfo.isActive),
      creditInfo,
      usdcBalance,
    };
  } catch (error) {
    console.error("Error fetching comprehensive user status:", error);
    return null;
  }
};

// New view functions from updated contracts

export const getLenderInfo = async (
  lenderAddress: string,
): Promise<{
  depositedAmount: number;
  earnedInterest: number;
  depositTimestamp: number;
} | null> => {
  try {
    const [depositedAmount, earnedInterest, depositTimestamp] = await aptos.view<[string, string, string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_lender_info`,
        functionArguments: [ADMIN_ADDRESS, lenderAddress],
      },
    });

    return {
      depositedAmount: unitsToUsdc(depositedAmount),
      earnedInterest: unitsToUsdc(earnedInterest),
      depositTimestamp: parseInt(depositTimestamp),
    };
  } catch (error) {
    console.error("Error fetching lender info:", error);
    return null;
  }
};

export const getReputationData = async (
  userAddress: string,
): Promise<{
  score: number;
  lastUpdated: number;
  totalRepayments: number;
  onTimeRepayments: number;
  lateRepayments: number;
  defaults: number;
  tier: number;
  isInitialized: boolean;
} | null> => {
  try {
    const [score, lastUpdated, totalRepayments, onTimeRepayments, lateRepayments, defaults, tier, isInitialized] =
      await aptos.view<[string, string, string, string, string, string, number, boolean]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::reputation_manager::get_reputation_data`,
          functionArguments: [ADMIN_ADDRESS, userAddress],
        },
      });

    return {
      score: parseInt(score),
      lastUpdated: parseInt(lastUpdated),
      totalRepayments: parseInt(totalRepayments),
      onTimeRepayments: parseInt(onTimeRepayments),
      lateRepayments: parseInt(lateRepayments),
      defaults: parseInt(defaults),
      tier,
      isInitialized,
    };
  } catch (error) {
    console.error("Error fetching reputation data:", error);
    return null;
  }
};

export const getAllBorrowers = async (): Promise<string[]> => {
  try {
    const [borrowers] = await aptos.view<[string[]]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_all_borrowers`,
        functionArguments: [ADMIN_ADDRESS],
      },
    });
    return borrowers;
  } catch (error) {
    console.error("Error fetching all borrowers:", error);
    return [];
  }
};

export const getAllLenders = async (): Promise<string[]> => {
  try {
    const [lenders] = await aptos.view<[string[]]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_all_lenders`,
        functionArguments: [ADMIN_ADDRESS],
      },
    });
    return lenders;
  } catch (error) {
    console.error("Error fetching all lenders:", error);
    return [];
  }
};

export const getPoolStats = async (): Promise<{
  totalDeposited: number;
  totalBorrowed: number;
  totalRepaid: number;
  protocolFeesCollected: number;
  availableLiquidity: number;
  utilizationRate: number;
  isPaused: boolean;
} | null> => {
  try {
    const results = await Promise.allSettled([
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_total_deposited`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_total_borrowed`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_total_repaid`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_protocol_fees_collected`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_available_liquidity`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[string]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::get_utilization_rate`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view<[boolean]>({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::is_paused`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
    ]);

    const getValue = <T,>(result: PromiseSettledResult<T[]>, fallback: T): T => {
      if (result.status === "fulfilled") return result.value[0];
      console.error("Pool stats view call failed:", result.reason);
      return fallback;
    };

    return {
      totalDeposited: unitsToUsdc(getValue(results[0] as PromiseSettledResult<[string]>, "0")),
      totalBorrowed: unitsToUsdc(getValue(results[1] as PromiseSettledResult<[string]>, "0")),
      totalRepaid: unitsToUsdc(getValue(results[2] as PromiseSettledResult<[string]>, "0")),
      protocolFeesCollected: unitsToUsdc(getValue(results[3] as PromiseSettledResult<[string]>, "0")),
      availableLiquidity: unitsToUsdc(getValue(results[4] as PromiseSettledResult<[string]>, "0")),
      utilizationRate: parseInt(getValue(results[5] as PromiseSettledResult<[string]>, "0")) / 100,
      isPaused: getValue(results[6] as PromiseSettledResult<[boolean]>, false),
    };
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    return null;
  }
};

export const getCreditManagerInfo = async (): Promise<{
  admin: string;
  lendingPoolAddr: string;
  fixedInterestRate: number;
  isPaused: boolean;
} | null> => {
  try {
    const [admin, lendingPoolAddr, fixedInterestRate, isPaused] = await Promise.all([
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::credit_manager::get_admin`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::credit_manager::get_lending_pool_addr`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::credit_manager::get_fixed_interest_rate`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => parseInt(result)),
      aptos
        .view<[boolean]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::credit_manager::is_paused`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
    ]);

    return {
      admin,
      lendingPoolAddr,
      fixedInterestRate,
      isPaused,
    };
  } catch (error) {
    console.error("Error fetching credit manager info:", error);
    return null;
  }
};

export const getReputationManagerInfo = async (): Promise<{
  admin: string;
  creditManager: string;
  userCount: number;
  parameters: {
    onTimeBonus: number;
    latePaymentPenalty: number;
    defaultPenalty: number;
    maxScoreChange: number;
  };
  tierThresholds: {
    min: number;
    bronze: number;
    silver: number;
    gold: number;
    max: number;
  };
  isPaused: boolean;
} | null> => {
  try {
    const [admin, creditManager, userCount, parameters, tierThresholds, isPaused] = await Promise.all([
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::get_admin`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::get_credit_manager`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
      aptos
        .view<[string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::get_user_count`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => parseInt(result)),
      aptos
        .view<[string, string, string, string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::get_parameters`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([onTimeBonus, latePaymentPenalty, defaultPenalty, maxScoreChange]) => ({
          onTimeBonus: parseInt(onTimeBonus),
          latePaymentPenalty: parseInt(latePaymentPenalty),
          defaultPenalty: parseInt(defaultPenalty),
          maxScoreChange: parseInt(maxScoreChange),
        })),
      aptos
        .view<[string, string, string, string, string]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::get_tier_thresholds`,
            functionArguments: [],
          },
        })
        .then(([min, bronze, silver, gold, max]) => ({
          min: parseInt(min),
          bronze: parseInt(bronze),
          silver: parseInt(silver),
          gold: parseInt(gold),
          max: parseInt(max),
        })),
      aptos
        .view<[boolean]>({
          payload: {
            function: `${CONTRACT_ADDRESS}::reputation_manager::is_paused`,
            functionArguments: [ADMIN_ADDRESS],
          },
        })
        .then(([result]) => result),
    ]);

    return {
      admin,
      creditManager,
      userCount,
      parameters,
      tierThresholds,
      isPaused,
    };
  } catch (error) {
    console.error("Error fetching reputation manager info:", error);
    return null;
  }
};

export const testContractConnectivity = async (): Promise<{
  creditManagerExists: boolean;
  lendingPoolExists: boolean;
  reputationManagerExists: boolean;
  availableModules: string[];
  availableResources: string[];
  error?: string;
}> => {
  try {
    const accountResources = await aptos.getAccountResources({ accountAddress: ADMIN_ADDRESS });
    const resourceTypes = accountResources.map((resource) => resource.type);

    const accountModules = await aptos.getAccountModules({ accountAddress: ADMIN_ADDRESS });
    const moduleNames = accountModules.map((module) => module.abi?.name || "unknown");

    // Test basic view functions that should always work if contracts are deployed
    const results = await Promise.allSettled([
      aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::credit_manager::is_paused`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::lending_pool::is_paused`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
      aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::reputation_manager::is_paused`,
          functionArguments: [ADMIN_ADDRESS],
        },
      }),
    ]);

    return {
      creditManagerExists: results[0].status === "fulfilled",
      lendingPoolExists: results[1].status === "fulfilled",
      reputationManagerExists: results[2].status === "fulfilled",
      availableModules: moduleNames,
      availableResources: resourceTypes,
      error: results.some((r) => r.status === "rejected")
        ? results.find((r) => r.status === "rejected")?.reason?.message || "Unknown error"
        : undefined,
    };
  } catch (error: any) {
    return {
      creditManagerExists: false,
      lendingPoolExists: false,
      reputationManagerExists: false,
      availableModules: [],
      availableResources: [],
      error: error.message || "Unknown connectivity error",
    };
  }
};

export const stakeCollateralAndOpenCreditLine = async (
  collateralAmountUsdc: number,
  signAndSubmitTransaction: any,
  _account?: any,
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  const payload = {
    data: {
      function: `${CONTRACT_ADDRESS}::credit_manager::open_credit_line`,
      functionArguments: [ADMIN_ADDRESS, usdcToUnits(collateralAmountUsdc)],
    },
  };

  try {
    const result = await signAndSubmitTransaction(payload);
    return { success: true, hash: result.hash };
  } catch (error: any) {
    return { success: false, error: handleTransactionError(error) };
  }
};

export const addMoreCollateral = async (
  additionalAmountUsdc: number,
  signAndSubmitTransaction: any,
  _account?: any,
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  const payload = {
    data: {
      function: `${CONTRACT_ADDRESS}::credit_manager::add_collateral`,
      functionArguments: [ADMIN_ADDRESS, usdcToUnits(additionalAmountUsdc)],
    },
  };

  try {
    const result = await signAndSubmitTransaction(payload);
    return { success: true, hash: result.hash };
  } catch (error: any) {
    return { success: false, error: handleTransactionError(error) };
  }
};

export const withdrawCollateral = async (
  withdrawAmountUsdc: number,
  signAndSubmitTransaction: any,
  _account?: any,
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  const payload = {
    data: {
      function: `${CONTRACT_ADDRESS}::credit_manager::withdraw_collateral`,
      functionArguments: [ADMIN_ADDRESS, usdcToUnits(withdrawAmountUsdc)],
    },
  };

  try {
    const result = await signAndSubmitTransaction(payload);
    return { success: true, hash: result.hash };
  } catch (error: any) {
    return { success: false, error: handleTransactionError(error) };
  }
};

export const checkCollateralStatus = async (
  userAddress: string,
): Promise<{
  hasActiveCreditLine: boolean;
  collateralAmount: number;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  canWithdraw: number;
} | null> => {
  try {
    const creditInfo = await getCreditLineInfo(userAddress);

    if (!creditInfo) {
      return {
        hasActiveCreditLine: false,
        collateralAmount: 0,
        creditLimit: 0,
        currentDebt: 0,
        availableCredit: 0,
        canWithdraw: 0,
      };
    }

    const canWithdraw = creditInfo.currentDebt === 0 ? creditInfo.collateral : 0;

    return {
      hasActiveCreditLine: creditInfo.isActive,
      collateralAmount: creditInfo.collateral,
      creditLimit: creditInfo.creditLimit,
      currentDebt: creditInfo.currentDebt,
      availableCredit: creditInfo.availableCredit,
      canWithdraw,
    };
  } catch (error) {
    console.error("Error checking collateral status:", error);
    return null;
  }
};

export const getMinimumCollateralAmount = (): number => {
  return 1; // 1 USDC minimum
};

export const getCollateralRatio = (): number => {
  return 100; // 1:1 ratio (100%)
};

export const checkPoolLiquidity = async (requiredAmountUsdc: number): Promise<boolean> => {
  try {
    const [liquidity] = await aptos.view<[string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_available_liquidity`,
        functionArguments: [ADMIN_ADDRESS],
      },
    });

    const availableLiquidityUsdc = unitsToUsdc(liquidity);
    console.log(`Pool liquidity: ${availableLiquidityUsdc} USDC, Required: ${requiredAmountUsdc} USDC`);

    return availableLiquidityUsdc >= requiredAmountUsdc;
  } catch (error) {
    console.error("Error checking pool liquidity:", error);
    return false;
  }
};

export const validatePaymentPreconditions = async (
  userAddress: string,
  recipientAddress: string,
  amountUsdc: number,
): Promise<{ isValid: boolean; error?: string }> => {
  try {
    // 1. Check if amount is valid
    if (!validateUsdcAmount(amountUsdc)) {
      return { isValid: false, error: "Invalid payment amount" };
    }

    // 2. Check if recipient address is valid
    if (!validateAptosAddress(recipientAddress)) {
      return { isValid: false, error: "Invalid recipient address" };
    }

    // 3. Check pool liquidity
    const hasLiquidity = await checkPoolLiquidity(amountUsdc);
    if (!hasLiquidity) {
      return { isValid: false, error: "Insufficient liquidity in pool for this payment" };
    }

    // 4. Check user's credit info
    const creditInfo = await getCreditLineInfo(userAddress);
    if (!creditInfo || !creditInfo.isActive) {
      return { isValid: false, error: "Credit line not active" };
    }

    if (amountUsdc > creditInfo.availableCredit) {
      return { isValid: false, error: "Payment exceeds available credit" };
    }

    return { isValid: true };
  } catch (error) {
    console.error("Error validating payment preconditions:", error);
    return { isValid: false, error: "Failed to validate payment conditions" };
  }
};

// New view function wrappers for updated contracts

export const getCollateralWithInterest = async (
  borrowerAddress: string,
): Promise<{
  principal: number;
  earnedInterest: number;
  total: number;
} | null> => {
  try {
    const [principal, earnedInterest, total] = await aptos.view<[string, string, string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::get_collateral_with_interest`,
        functionArguments: [ADMIN_ADDRESS, borrowerAddress],
      },
    });
    return {
      principal: unitsToUsdc(principal),
      earnedInterest: unitsToUsdc(earnedInterest),
      total: unitsToUsdc(total),
    };
  } catch (error) {
    console.error("Error fetching collateral with interest:", error);
    return null;
  }
};

export const getCollateralDetails = async (
  borrowerAddress: string,
): Promise<{
  principal: number;
  earnedInterest: number;
  total: number;
} | null> => {
  try {
    const [principal, earnedInterest, total] = await aptos.view<[string, string, string]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_collateral_details`,
        functionArguments: [ADMIN_ADDRESS, borrowerAddress],
      },
    });
    return {
      principal: unitsToUsdc(principal),
      earnedInterest: unitsToUsdc(earnedInterest),
      total: unitsToUsdc(total),
    };
  } catch (error) {
    console.error("Error fetching collateral details:", error);
    return null;
  }
};

export const getCreditLineStatus = async (
  borrowerAddress: string,
): Promise<{
  exists: boolean;
  isActive: boolean;
  collateral: number;
  limit: number;
  borrowed: number;
} | null> => {
  try {
    const [exists, isActive, collateral, limit, borrowed] = await aptos.view<
      [boolean, boolean, string, string, string]
    >({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::get_credit_line_status`,
        functionArguments: [ADMIN_ADDRESS, borrowerAddress],
      },
    });
    return {
      exists,
      isActive,
      collateral: unitsToUsdc(collateral),
      limit: unitsToUsdc(limit),
      borrowed: unitsToUsdc(borrowed),
    };
  } catch (error) {
    console.error("Error fetching credit line status:", error);
    return null;
  }
};

export const hasCreditLine = async (borrowerAddress: string): Promise<boolean> => {
  try {
    const [exists] = await aptos.view<[boolean]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::credit_manager::has_credit_line`,
        functionArguments: [ADMIN_ADDRESS, borrowerAddress],
      },
    });
    return exists;
  } catch (error) {
    console.error("Error checking credit line existence:", error);
    return false;
  }
};

export const hasCollateral = async (borrowerAddress: string): Promise<boolean> => {
  try {
    const [has] = await aptos.view<[boolean]>({
      payload: {
        function: `${CONTRACT_ADDRESS}::lending_pool::has_collateral`,
        functionArguments: [ADMIN_ADDRESS, borrowerAddress],
      },
    });
    return has;
  } catch (error) {
    console.error("Error checking collateral:", error);
    return false;
  }
};

export type RecentTransaction = {
  type: "borrow" | "payment" | "repay" | "stake" | "collateral_withdrawn" | "credit_opened";
  amount: number;
  date: string;
  status: string;
  hash?: string;
};

const EVENT_TYPE_MAP: Record<string, RecentTransaction["type"]> = {
  [`${CONTRACT_ADDRESS}::credit_manager::BorrowedEvent`]: "borrow",
  [`${CONTRACT_ADDRESS}::credit_manager::DirectPaymentEvent`]: "payment",
  [`${CONTRACT_ADDRESS}::credit_manager::RepaidEvent`]: "repay",
  [`${CONTRACT_ADDRESS}::credit_manager::CollateralAddedEvent`]: "stake",
  [`${CONTRACT_ADDRESS}::credit_manager::CollateralWithdrawnEvent`]: "collateral_withdrawn",
  [`${CONTRACT_ADDRESS}::credit_manager::CreditOpenedEvent`]: "credit_opened",
};

export const getRecentTransactions = async (
  borrowerAddress: string,
  limit: number = 20
): Promise<RecentTransaction[]> => {
  try {
    // Fetch account transactions via Aptos REST API
    const response = await fetch(
      `https://api.mainnet.aptoslabs.com/v1/accounts/${borrowerAddress}/transactions?limit=50`
    );

    if (!response.ok) {
      console.error("Failed to fetch account transactions:", response.status);
      return [];
    }

    const txns = await response.json();
    const results: RecentTransaction[] = [];

    for (const txn of txns) {
      if (!txn.events || txn.success === false) continue;

      for (const event of txn.events) {
        const txType = EVENT_TYPE_MAP[event.type];
        if (!txType) continue;

        // Verify this event is for the borrower
        if (event.data?.borrower && event.data.borrower !== borrowerAddress) continue;

        const timestamp = parseInt(txn.timestamp || "0", 10) / 1_000_000; // Aptos timestamps are in microseconds

        let amount = 0;
        if (txType === "repay") {
          const principal = parseInt(event.data.principal_amount || "0", 10);
          const interest = parseInt(event.data.interest_amount || "0", 10);
          amount = unitsToUsdc(principal + interest);
        } else if (txType === "credit_opened") {
          amount = unitsToUsdc(event.data.collateral_amount || "0");
        } else {
          amount = unitsToUsdc(event.data.amount || "0");
        }

        results.push({
          type: txType,
          amount,
          date: formatTimestamp(timestamp),
          status: "completed",
          hash: txn.version?.toString(),
        });
      }

      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    return [];
  }
};

const formatTimestamp = (timestampSecs: number): string => {
  if (timestampSecs === 0) return "Unknown";
  const now = Math.floor(Date.now() / 1000);
  const diffSecs = now - timestampSecs;

  if (diffSecs < 60) return "Just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} min ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
  if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)} days ago`;

  const date = new Date(timestampSecs * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
