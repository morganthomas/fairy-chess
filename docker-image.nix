{ pkgs ? import <nixpkgs> {}
, node-fairy-chess ? import ./default.nix { inherit pkgs; } }:
let
  startScript = pkgs.writeScriptBin "start-sequence" ''
    mkdir /tmp
    cd ${node-fairy-chess.package.outPath}/lib/node_modules/fairy-chess
    ${pkgs.nodejs}/bin/node app.js
    # ${pkgs.nodePackages.forever}/bin/forever start app.js
    # sleep infinity
  '';
in
pkgs.dockerTools.buildLayeredImage {
  name    = "fairy-chess";
  tag     = "latest";
  created = "now";
  contents = [ pkgs.bash
               pkgs.coreutils
               pkgs.procps
               pkgs.curl
               pkgs.nettools
               pkgs.which
               pkgs.nodePackages.forever
               pkgs.mongodb
             ];
  config = {
    Cmd = [ "${pkgs.bash}/bin/bash" "${startScript}/bin/start-sequence" ];
  };
}
