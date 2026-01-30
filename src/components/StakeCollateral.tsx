import React, { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  stakeCollateralAndOpenCreditLine,
  addMoreCollateral,
  withdrawCollateral,
  checkCollateralStatus,
  fetchUsdcBalance,
  getMinimumCollateralAmount,
  getCollateralRatio
} from '../lib/contractUtils';

interface CollateralStatus {
  hasActiveCreditLine: boolean;
  collateralAmount: number;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  canWithdraw: number;
}

export const StakeCollateral: React.FC = () => {
  const { account, signAndSubmitTransaction, connected } = useWallet();

  // UI State
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stake' | 'add' | 'withdraw'>('stake');

  // Data State
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [collateralStatus, setCollateralStatus] = useState<CollateralStatus | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Constants
  const minAmount = getMinimumCollateralAmount();
  const collateralRatio = getCollateralRatio();

  // Load user data
  const loadData = async () => {
    if (!connected || !account?.address) return;

    setLoadingData(true);
    try {
      const [balance, status] = await Promise.all([
        fetchUsdcBalance(account.address),
        checkCollateralStatus(account.address)
      ]);

      setUsdcBalance(balance);
      setCollateralStatus(status);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load account data');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [connected, account?.address]);

  // Handle staking collateral (open credit line)
  const handleStakeCollateral = async () => {
    if (!connected || !account) {
      setError('Please connect your wallet');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < minAmount) {
      setError(`Minimum amount is ${minAmount} USDC`);
      return;
    }

    if (amountNum > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await stakeCollateralAndOpenCreditLine(
        amountNum,
        signAndSubmitTransaction,
        account
      );

      if (result.success) {
        setSuccess(`🎉 Successfully staked ${amountNum} USDC as collateral!`);
        setAmount('');
        await loadData(); // Refresh data
      } else {
        setError(result.error || 'Transaction failed');
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding more collateral
  const handleAddCollateral = async () => {
    if (!connected || !account) {
      setError('Please connect your wallet');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await addMoreCollateral(
        amountNum,
        signAndSubmitTransaction,
        account
      );

      if (result.success) {
        setSuccess(`💰 Successfully added ${amountNum} USDC collateral!`);
        setAmount('');
        await loadData();
      } else {
        setError(result.error || 'Transaction failed');
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle withdrawing collateral
  const handleWithdrawCollateral = async () => {
    if (!connected || !account) {
      setError('Please connect your wallet');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!collateralStatus || amountNum > collateralStatus.canWithdraw) {
      setError(`Maximum withdrawable: ${collateralStatus?.canWithdraw || 0} USDC`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await withdrawCollateral(
        amountNum,
        signAndSubmitTransaction,
        account
      );

      if (result.success) {
        setSuccess(`🏃‍♂️ Successfully withdrew ${amountNum} USDC collateral!`);
        setAmount('');
        await loadData();
      } else {
        setError(result.error || 'Transaction failed');
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    switch (activeTab) {
      case 'stake':
        handleStakeCollateral();
        break;
      case 'add':
        handleAddCollateral();
        break;
      case 'withdraw':
        handleWithdrawCollateral();
        break;
    }
  };

  if (!connected) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">🏦 Stake Collateral</h2>
        <p className="text-gray-600">Please connect your wallet to stake collateral</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🏦 Stake Collateral</h2>

      {/* Account Info */}
      {loadingData ? (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <p>Loading account data...</p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">USDC Balance:</span>
              <span className="ml-2">{usdcBalance.toFixed(2)} USDC</span>
            </div>
            <div>
              <span className="font-medium">Collateral Ratio:</span>
              <span className="ml-2">{collateralRatio}% (1:1)</span>
            </div>
            <div>
              <span className="font-medium">Staked Collateral:</span>
              <span className="ml-2">{collateralStatus?.collateralAmount?.toFixed(2) || '0.00'} USDC</span>
            </div>
            <div>
              <span className="font-medium">Credit Limit:</span>
              <span className="ml-2">{collateralStatus?.creditLimit?.toFixed(2) || '0.00'} USDC</span>
            </div>
            <div>
              <span className="font-medium">Current Debt:</span>
              <span className="ml-2 text-red-600">{collateralStatus?.currentDebt?.toFixed(2) || '0.00'} USDC</span>
            </div>
            <div>
              <span className="font-medium">Available Credit:</span>
              <span className="ml-2 text-green-600">{collateralStatus?.availableCredit?.toFixed(2) || '0.00'} USDC</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex mb-6 border-b">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'stake' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveTab('stake')}
          disabled={collateralStatus?.hasActiveCreditLine}
        >
          🏦 Stake Collateral
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'add' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveTab('add')}
          disabled={!collateralStatus?.hasActiveCreditLine}
        >
          💰 Add Collateral
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'withdraw' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveTab('withdraw')}
          disabled={!collateralStatus?.hasActiveCreditLine || (collateralStatus?.canWithdraw || 0) <= 0}
        >
          🏃‍♂️ Withdraw Collateral
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'stake' && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2">Open Credit Line</h3>
            <p className="text-sm text-gray-600 mb-4">
              Stake USDC as collateral to open a 1:1 credit line. You can borrow up to the amount you stake.
            </p>
            {collateralStatus?.hasActiveCreditLine && (
              <p className="text-orange-600 text-sm mb-4">
                ⚠️ You already have an active credit line. Use "Add Collateral" to increase your limit.
              </p>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium mb-2">Add More Collateral</h3>
            <p className="text-sm text-gray-600 mb-4">
              Increase your collateral to get a higher credit limit. Each 1 USDC collateral = 1 USDC credit limit.
            </p>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="p-4 bg-orange-50 rounded-lg">
            <h3 className="font-medium mb-2">Withdraw Collateral</h3>
            <p className="text-sm text-gray-600 mb-4">
              You can only withdraw collateral when you have no outstanding debt.
              Available to withdraw: <strong>{collateralStatus?.canWithdraw?.toFixed(2) || '0.00'} USDC</strong>
            </p>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Amount (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimum: ${minAmount} USDC`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
              disabled={loading}
            />
            <button
              onClick={() => {
                if (activeTab === 'stake' || activeTab === 'add') {
                  setAmount(usdcBalance.toString());
                } else {
                  setAmount((collateralStatus?.canWithdraw || 0).toString());
                }
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 text-sm hover:text-blue-800"
              disabled={loading}
            >
              Max
            </button>
          </div>

          {activeTab === 'stake' && parseFloat(amount) > 0 && (
            <p className="text-sm text-green-600">
              ✅ You'll get {parseFloat(amount).toFixed(2)} USDC credit limit
            </p>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </span>
          ) : (
            <>
              {activeTab === 'stake' && `🏦 Stake ${amount || '0'} USDC`}
              {activeTab === 'add' && `💰 Add ${amount || '0'} USDC`}
              {activeTab === 'withdraw' && `🏃‍♂️ Withdraw ${amount || '0'} USDC`}
            </>
          )}
        </button>

        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">ℹ️ How It Works</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>1:1 Ratio:</strong> 1 USDC collateral = 1 USDC credit limit</li>
            <li>• <strong>Minimum:</strong> {minAmount} USDC to start</li>
            <li>• <strong>Withdrawal:</strong> Only when debt is fully repaid</li>
            <li>• <strong>Interest:</strong> 15% APR on borrowed amounts</li>
            <li>• <strong>Repayment:</strong> Flexible, improves credit score</li>
          </ul>
        </div>
      </div>
    </div>
  );
};