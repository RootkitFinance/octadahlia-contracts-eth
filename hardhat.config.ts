import '@typechain/hardhat';
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig =  {
  solidity: "0.7.6",
  paths: {
    sources: './contracts/**/'
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000"
      },
      allowUnlimitedContractSize: true,
      chainId: 1
    }
  }
};

export default config;