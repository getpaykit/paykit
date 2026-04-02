{
  description = "PayKit - Open payments orchestration for modern SaaS";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js 22 as specified in .nvmrc
            nodejs_22

            # pnpm as specified in package.json (nixpkgs has 10.4.1)
            pnpm

            # Build tools
            turbo

            # Formatters and linters
            oxfmt
            oxlint

            # Additional dev tools
            git

            # Shell utilities
            jq
          ];
        };
      }
    );
}
