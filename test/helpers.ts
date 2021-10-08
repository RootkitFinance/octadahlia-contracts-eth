import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { ethers } from "hardhat";
import { utils } from "ethers";

import UniswapV2FactoryJson from '../contracts/json/UniswapV2Factory.json';
import UniswapV2Router02Json from '../contracts/json/UniswapV2Router02.json';

export async function createUniswap(owner: SignerWithAddress) {
    const erc20Factory = await ethers.getContractFactory("ERC20Test");
    const weth = await erc20Factory.connect(owner).deploy();
    const factory = await new ethers.ContractFactory(UniswapV2FactoryJson.abi, UniswapV2FactoryJson.bytecode, owner).deploy(owner.address);
    const router = await new ethers.ContractFactory(UniswapV2Router02Json.abi, UniswapV2Router02Json.bytecode, owner).deploy(factory.address, weth.address);
    return { factory, router };
}

