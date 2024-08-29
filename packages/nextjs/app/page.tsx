"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { EtherInput } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const [currentSlide, setCurrentSlide] = useState(1);

  const totalSlides = 3;

  const prevSlide = () => {
    setCurrentSlide(prev => (prev === 1 ? totalSlides : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide(prev => (prev === totalSlides ? 1 : prev + 1));
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const [ethAmount1, setEthAmount1] = useState("");
  const [ethAmount2, setEthAmount2] = useState("");
  const [ethAmount3, setEthAmount3] = useState("");
  const [ethAmount4, setEthAmount4] = useState("");

  return (
    <>
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 200px)" }}>
        <div className="flex items-center justify-center flex-grow">
          <div className="carousel rounded-box w-96">
            <div id="slide1" className="carousel-item relative w-full">
              <div className="card card-compact bg-base-100 w-96 shadow-xl border-2 border-primary">
                <figure>
                  <picture>
                    <img src="/floxiEthVault.png" alt="Staked Frax Ether Vault" />
                  </picture>
                </figure>
                <div className="card-body">
                  <h2 className="card-title">Staked Frax ETH Vault</h2>
                  <p>Restake your sfrxEth on Eigenlayer to earn restaking + FTXL rewards</p>
                  <div className="card-actions justify-end">
                    <button className="btn btn-primary" onClick={openModal}>
                      Restake
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div id="slide2" className="carousel-item relative w-full">
              <div className="card card-compact bg-base-100 w-96 shadow-xl border-2 border-primary relative overflow-hidden">
                <figure className="grayscale opacity-50">
                  <picture>
                    <img src="/floxi_logo.webp" alt="Staked Frax Ether Vault" />
                  </picture>
                </figure>
                <div className="card-body opacity-50 ">
                  <h2 className="card-title">FRAX Vault</h2>
                  <p>Restake your FRAX on Eigenlayer to earn restaking + FTXL rewards</p>
                  <div className="card-actions justify-end">
                    <button className="btn btn-primary btn-disabled" disabled>
                      Restake
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <h2 className="text-5xl transform rotate-45 opacity-100 translate-y-[-200%]">Coming Soon</h2>
                </div>
              </div>
            </div>

            <div id="slide3" className="carousel-item relative w-full">
              <div className="card card-compact bg-base-100 w-96 shadow-xl border-2 border-primary relative overflow-hidden">
                <figure className="grayscale opacity-50">
                  <picture>
                    <img src="/floxi_logo.webp" alt="Staked Frax Ether Vault" />
                  </picture>
                </figure>
                <div className="card-body opacity-50 ">
                  <h2 className="card-title">FXS Vault</h2>
                  <p>Restake your FXS on Eigenlayer to earn restaking + FTXL rewards</p>
                  <div className="card-actions justify-end">
                    <button className="btn btn-primary btn-disabled" disabled>
                      Restake
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <h2 className="text-5xl transform rotate-45 opacity-100 translate-y-[-200%]">Coming Soon</h2>
                </div>
              </div>
            </div>

            <div className="absolute left-5 right-5 top-1/2 transform -translate-y-1/2 flex justify-between">
              <Link
                className="btn btn-circle"
                onClick={prevSlide}
                href={`#slide${currentSlide === 1 ? totalSlides : currentSlide - 1}`}
              >
                ❮
              </Link>
              <Link
                className="btn btn-circle"
                onClick={nextSlide}
                href={`#slide${currentSlide === totalSlides ? 1 : currentSlide + 1}`}
              >
                ❯
              </Link>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <dialog id="stake_modal" className="modal" open>
            <div className="modal-box">
              <div role="tablist" className="tabs tabs-bordered">
                {/* Deposit Tab */}
                <input type="radio" name="tabs_1" role="tab" className="tab" aria-label="Deposit" defaultChecked />
                <div role="tabpanel" className="tab-content p-10">
                  <h3 className="font-bold text-lg">Deposit & Stake</h3>
                  <p className="py-0">Step 1: Deposit assets</p>
                  <EtherInput
                    key="1"
                    contractName="sFraxEth"
                    value={ethAmount1}
                    placeholder="amount"
                    onChange={amount => setEthAmount1(amount)}
                  />
                  <div className="flex justify-end w-full mt-2">
                    <Link
                      href={""}
                      className="bg-secondary shadow-md hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid-flow-col w-20 text-center flex items-center justify-center"
                    >
                      <span>Deposit</span>
                    </Link>
                  </div>
                  <p className="py-0">Step 2: Claim shares</p>
                  <EtherInput
                    key="2"
                    contractName="FloxiSfrxEth"
                    value={ethAmount2}
                    placeholder="amount"
                    onChange={amount => setEthAmount2(amount)}
                  />
                  <div className="flex justify-end w-full mt-2">
                    <Link
                      href={""}
                      className="bg-secondary shadow-md hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid-flow-col w-20 text-center flex items-center justify-center"
                    >
                      <span>Claim</span>
                    </Link>
                  </div>
                  <p className="py-1">
                    Vault deposits require two steps. Check back after your deposit is complete to claim your shares.
                  </p>
                </div>

                {/* Withdrawal Tab */}
                <input type="radio" name="tabs_1" role="tab" className="tab" aria-label="Withdraw" />
                <div role="tabpanel" className="tab-content p-10">
                  <h3 className="font-bold text-lg">Unstake & Withdraw</h3>
                  <p className="py-0">Step 1: Request withdrawal</p>
                  <EtherInput
                    key="3"
                    contractName="sFraxEth"
                    value={ethAmount3}
                    placeholder="amount"
                    onChange={amount => setEthAmount3(amount)}
                  />
                  <div className="flex justify-end w-full mt-2">
                    <Link
                      href={""}
                      className="bg-secondary shadow-md hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid-flow-col w-20 text-center flex items-center justify-center"
                    >
                      <span>Request</span>
                    </Link>
                  </div>
                  <p className="py-0">Step 2: Claim assets</p>
                  <EtherInput
                    key="4"
                    contractName="FloxiSfrxEth"
                    value={ethAmount4}
                    placeholder="amount"
                    onChange={amount => setEthAmount4(amount)}
                  />
                  <div className="flex justify-end w-full mt-2">
                    <Link
                      href={""}
                      className="bg-secondary shadow-md hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid-flow-col w-20 text-center flex items-center justify-center"
                    >
                      <span>Claim</span>
                    </Link>
                  </div>
                  <p className="py-1">
                    Vault withdrawals require two steps. Check back after your request is complete to claim your assets.
                  </p>
                </div>
              </div>
              <div className="modal-action">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={closeModal}>
                  ✕
                </button>
              </div>
            </div>
          </dialog>
        )}
      </div>
    </>
  );
};

export default Home;
