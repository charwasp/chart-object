{ pkgs ? import <nixpkgs> {} }: with pkgs; mkShell {
	packages = [
		nodejs_22
	];
	shellHook = ''
		export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:${lib.makeLibraryPath [ alsa-lib ]}
	'';
}
