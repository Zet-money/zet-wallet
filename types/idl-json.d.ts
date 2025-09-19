declare module '@zetachain/protocol-contracts-solana/*/idl/*.json' {
  const idl: any; // Optionally narrow to anchor.Idl if available in types
  export default idl;
}

declare module '*.json' {
  const value: any;
  export default value;
}


