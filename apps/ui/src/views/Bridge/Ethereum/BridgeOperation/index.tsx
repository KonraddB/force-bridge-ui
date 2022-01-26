import { useFormik } from 'formik';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAllowance } from '../hooks/useAllowance';
import { useApproveTransaction } from '../hooks/useApproveTransaction';
import { SubmitButton } from './SubmitButton';
import { useAutoSetBridgeToAmount } from './useAutoSetBridgeToAmount';
import { AssetSelector } from 'components/AssetSelector';
import { UserInput } from 'components/UserInput';
import { Button, Typography } from '@mui/material';
import { BridgeOperationFormContainer } from 'containers/BridgeOperationFormContainer';
import { BridgeDirection, ForceBridgeContainer } from 'containers/ForceBridgeContainer';
import { boom } from 'errors';
import { useValidateBridgeOperationForm, ValidateResult } from 'hooks/bridge-operation';
import { useAssetQuery } from 'hooks/useAssetQuery';
import { useSearchParams } from 'hooks/useSearchParams';
import { BeautyAmount } from 'libs';
import { useSelectBridgeAsset } from 'views/Bridge/hooks/useSelectBridgeAsset';
import { useSendBridgeTransaction } from 'views/Bridge/hooks/useSendBridgeTransaction';
import forcebridge from '../../../../assets/images/forcebridge-white.png';
import { ForceBridgeLogo, Transfer } from './styled';
import { ConnectStatus } from 'interfaces/WalletConnector';
import { TransferModal } from 'components/TransferModal';
import { TransferAccordion } from 'components/TransferAccordion';
import { NetworkDirectionSelector } from 'components/NetworkDirectionSelector/NetworkDirectionSelector';
import { NetworkDirectionPreview } from 'components/NetworkDirectionPreview/NetworkDirectionPreview';

const Help: React.FC<{ validateStatus: 'error' | ''; help?: string }> = ({ validateStatus, help }) => {
  if (validateStatus !== 'error') return null;
  return (
    <Typography variant="body2" color="info.main" marginTop={1}>
      {help}
    </Typography>
  );
};

export const BridgeOperationForm: React.FC = () => {
  useAutoSetBridgeToAmount();

  const {
    signer,
    network,
    direction,
    switchBridgeDirection,
    switchNetwork,
    supportedNetworks,
  } = ForceBridgeContainer.useContainer();
  const query = useAssetQuery();
  const location = useLocation();
  const history = useHistory();
  const { selectedAsset, setSelectedAsset } = useSelectBridgeAsset();

  const searchParams = useSearchParams();
  const initRecipient = searchParams.get('recipient');
  const initAmount = searchParams.get('amount');

  const { validate, status: validateStatus, reset, result: errors } = useValidateBridgeOperationForm();

  useEffect(() => {
    validate();
  }, [validate]);

  const formik = useFormik<ValidateResult>({
    onSubmit,
    initialValues: {},
    validate,
    initialTouched: { bridgeInInputAmount: !!initAmount, recipient: !!initRecipient },
  });

  const {
    bridgeFromAmount,
    setBridgeFromAmount,
    setRecipient,
    recipient,
  } = BridgeOperationFormContainer.useContainer();

  const { walletConnectStatus } = ForceBridgeContainer.useContainer();
  const isConnected = walletConnectStatus === ConnectStatus.Connected;

  const allowance = useAllowance(selectedAsset);
  const enableApproveButton = allowance && allowance.status === 'NeedApprove';

  const { mutateAsync: sendBridgeTransaction, isLoading: isBridgeLoading } = useSendBridgeTransaction();
  const { mutateAsync: sendApproveTransaction, isLoading: isApproveLoading } = useApproveTransaction();
  const isLoading = isBridgeLoading || isApproveLoading;
  const [loadingDialog, setLoadingDialog] = useState<boolean>(false);

  function resetForm() {
    reset();
    console.log('reset');
    if (!signer) return;

    if (direction === BridgeDirection.In) setRecipient(signer.identityNervos());
    else setRecipient(signer.identityXChain());
  }

  useEffect(resetForm, [direction, reset, setRecipient, signer]);

  function onSubmit() {
    if (!selectedAsset || !recipient || !selectedAsset.shadow) return;

    if (allowance && allowance.status === 'NeedApprove') {
      sendApproveTransaction({ asset: selectedAsset, addApprove: allowance.addApprove }).then(afterSubmit);
    } else {
      const asset = direction === BridgeDirection.In ? selectedAsset.copy() : selectedAsset.shadow?.copy();
      if (asset.info?.decimals == null) boom('asset info is not loaded');

      asset.amount = BeautyAmount.fromHumanize(bridgeFromAmount, asset.info.decimals).val.toString();
      sendBridgeTransaction({ asset, recipient }).then(afterSubmit);
    }
    setLoadingDialog(true);
  }

  const afterSubmit = () => {
    resetForm();
  };

  const assetList = useMemo(() => {
    if (!query.data) return [];
    if (direction === BridgeDirection.In) return query.data.xchain;
    return query.data.nervos;
  }, [direction, query.data]);

  // bind url query with the input
  useEffect(() => {
    if (!initRecipient && !initAmount) return;

    setRecipient(initRecipient ?? '');
    setBridgeFromAmount(initAmount ?? '');
  }, [initAmount, initRecipient, setBridgeFromAmount, setRecipient, signer]);

  // remove recipient and amount from url once signer loaded
  useEffect(() => {
    if (!signer) return;
    if (!initAmount && !initRecipient) return;

    searchParams.delete('recipient');
    searchParams.delete('amount');

    history.replace({ search: searchParams.toString() });
  }, [signer, searchParams, history, location, initAmount, initRecipient]);

  const statusOf = (name: keyof ValidateResult) => {
    const touched = formik.touched[name];
    const message = errors?.[name];

    const status = (touched && message ? 'error' : '') as 'error' | '';
    const help = status === 'error' ? message : '';
    return { help, validateStatus: status };
  };

  const [open, setOpen] = useState<boolean>(false);
  const handleClose = () => setOpen(false);

  const submitForm = () => {
    formik.submitForm();
  };

  const openDialog = () => {
    setOpen(true);
  };

  const labelSymbol = direction === 'In' ? 'CKB' : 'ETH';

  return (
    <>
      <ForceBridgeLogo src={forcebridge} />
      <Transfer>
        <NetworkDirectionSelector
          networks={supportedNetworks}
          network={network}
          direction={direction}
          onSelect={({ network, direction }) => {
            switchNetwork(network);
            switchBridgeDirection(direction);
          }}
        />
        <NetworkDirectionPreview
          networks={supportedNetworks}
          network={network}
          direction={direction}
          onSelect={({ network, direction }) => {
            switchNetwork(network);
            switchBridgeDirection(direction);
          }}
        />
        <div className="input-wrapper">
          <AssetSelector
            btnProps={{ disabled: query.data == null, loading: query.isLoading }}
            options={assetList}
            rowKey={(asset) => asset.identity()}
            selected={selectedAsset?.identity()}
            onSelect={(_id, asset) => setSelectedAsset(asset)}
          />
        </div>

        <UserInput
          id="bridgeInInputAmount"
          name="bridgeInInputAmount"
          onBlur={formik.handleBlur}
          value={bridgeFromAmount}
          onChange={(e) => setBridgeFromAmount(e.target.value)}
          label={'Amount'}
          error={statusOf('bridgeInInputAmount').validateStatus === 'error'}
          endAdornment={
            selectedAsset && (
              <Button
                variant="contained"
                size="small"
                onClick={() => setBridgeFromAmount(BeautyAmount.from(selectedAsset).humanize({ separator: false }))}
              >
                Max
              </Button>
            )
          }
          placeholder="0.0"
          disabled={selectedAsset == null || signer == null}
        />
        <Help {...statusOf('bridgeInInputAmount')} />

        <div className="input-wrapper">
          <UserInput
            id="recipient"
            name="recipient"
            onBlur={formik.handleBlur}
            label={`To ${labelSymbol} Address`}
            error={statusOf('recipient').validateStatus === 'error'}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <Help {...statusOf('recipient')} />
        </div>

        {recipient && bridgeFromAmount && selectedAsset && <TransferAccordion selectedAsset={selectedAsset} />}

        <SubmitButton
          disabled={validateStatus !== 'success' && !enableApproveButton && isConnected}
          onClick={() => openDialog()}
          allowanceStatus={allowance}
          isloading={isLoading}
        />
      </Transfer>
      {selectedAsset && (
        <TransferModal
          open={open}
          onClose={handleClose}
          submitForm={submitForm}
          selectedAsset={selectedAsset}
          recipient={recipient}
          loadingDialog={loadingDialog}
        />
      )}
    </>
  );
};
