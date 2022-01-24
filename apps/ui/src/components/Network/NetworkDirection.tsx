import { ArrowRightOutlined } from '@ant-design/icons';
import { Col, Row } from 'antd';
import React from 'react';
import styled from 'styled-components';
import { NetworkIcon } from 'components/Network/NetworkIcon';
import { AssetLogo } from 'components/AssetLogo';
import { ChevronDoubleRightIcon } from '@heroicons/react/solid';
import { Typography } from '@mui/material';

export interface NetworkDirectionProps {
  from: string;
  to: string;
}

export const NetworkDirection: React.FC<NetworkDirectionProps> = (props) => {
  const { from, to } = props;

  return (
    <>
      <AssetLogo sx={{ width: 20, height: 20 }} network={from} />
      <Typography>{from}</Typography>
      <ChevronDoubleRightIcon />
      <AssetLogo sx={{ width: 20, height: 20 }} network={to} />
      <Typography>{to}</Typography>
    </>
  );
};
