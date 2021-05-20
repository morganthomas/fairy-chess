{ pkgs ? import <nixpkgs> {}
, node-fairy-chess ? import ./default.nix { inherit pkgs; } }:
let
  startScript = pkgs.writeScriptBin "start-sequence" ''
    mkdir -p /tmp
    mkdir -p /data/db
    mkdir -p /var/log/mongodb
    mongod --dbpath /data/db --logpath /var/log/mongodb/mongod.log --port 27108 --fork
    tail -f /var/log/mongodb/mongod.log &
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
