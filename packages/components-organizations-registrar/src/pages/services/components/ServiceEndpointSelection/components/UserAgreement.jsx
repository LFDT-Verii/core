import { Typography, Link } from '@mui/material';
import PropTypes from 'prop-types';
import { useConfig } from '@/utils/ConfigContext.js';
import { chainNames } from '@/utils/chainNames.js';

export const UserAgreement = ({ isWallet }) => {
  const config = useConfig();
  return (
    config.chainName !== chainNames.testnet && (
      <Typography variant="subtitle1" sx={sx.userAgreement}>
        <span>By clicking Add, you agree to our </span>
        {isWallet ? (
          <Link
            target="_blank"
            href="https://velocitynetwork.foundation/wp-content/uploads/2022/07/VNF-Wallet-Operator-Agreement-v1.1.pdf"
          >
            Wallet Developer Agreement
          </Link>
        ) : (
          <Link
            target="_blank"
            href="https://www.velocitynetwork.foundation/main2/participation-agreements"
          >
            Participant Agreement
          </Link>
        )}
      </Typography>
    )
  );
};

const sx = {
  userAgreement: {
    marginTop: '10px',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
UserAgreement.propTypes = {
  isWallet: PropTypes.bool.isRequired,
};
