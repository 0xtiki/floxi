"use client";

import { Poppins } from "next/font/google";
// import { useAccount } from "wagmi";
import Image from "next/image";
import type { NextPage } from "next";

// Import the Poppins font from Google Fonts
const poppins = Poppins({
  weight: ["400", "600"], // Regular and semi-bold weights
  subsets: ["latin"],
});

const Home: NextPage = () => {
  // const { address: connectedAddress } = useAccount();

  return (
    <>
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-8">
          <Image src="/floxi_logo.webp" alt="Logo" width={500} height={500} />
          <h1 className={`text-4xl font-semibold ${poppins.className} text-center`}>Floxi Finance</h1>
        </div>
      </div>
    </>
  );
};

export default Home;
