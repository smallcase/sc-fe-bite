# Changelog

## 1.0.0 (2026-04-15)


### ⚠ BREAKING CHANGES

* Renamed the command to be tsx-transform

### Features

* add support for babel plugin ([06a1c5c](https://github.com/smallcase/sc-fe-bite/commit/06a1c5cc010e60da565975427d8be609d4fdb6bf))
* add support for babel plugin ([bed467d](https://github.com/smallcase/sc-fe-bite/commit/bed467d78d85439095f5bdf1585111c3fa050e77))
* add support for new commands with bite prefix and deprecation notice ([0e24336](https://github.com/smallcase/sc-fe-bite/commit/0e24336df7c21a1e214d0bbf53dcc60e1bc473d6))
* add the basic cli script ([f6d69e2](https://github.com/smallcase/sc-fe-bite/commit/f6d69e257dfbc76a48b7a4235a2c188f8d9b7548))
* let consumer pass ts and babel config ([ce6f2bd](https://github.com/smallcase/sc-fe-bite/commit/ce6f2bda4b2f29ef997a7a502e9b9b4b1af5c617))


### Bug Fixes

* add better spinner ([ec0312d](https://github.com/smallcase/sc-fe-bite/commit/ec0312d046a5507690d43bea8b11635b102245b0))
* add chalk and support for module type ([d3d708d](https://github.com/smallcase/sc-fe-bite/commit/d3d708df9c5a37f6d312026f5ced342bf9e389af))
* add citty and rename command ([4db93aa](https://github.com/smallcase/sc-fe-bite/commit/4db93aa87d1edc53820fa561a4942573bb70ab27))
* add debounced handling for the watcher ([084d24f](https://github.com/smallcase/sc-fe-bite/commit/084d24f9c2941b9ff1db381bd7bfb199546237a0))
* add gh npm rc ([c5643fd](https://github.com/smallcase/sc-fe-bite/commit/c5643fd0685f08c957ca2ce13f3582a6ec721e17))
* add GitHub Packages registry config to .npmrc ([dcc92c2](https://github.com/smallcase/sc-fe-bite/commit/dcc92c2c5c9f18ff37e558c7328c2726240420c1))
* add GitHub Packages registry to .npmrc ([fafbc97](https://github.com/smallcase/sc-fe-bite/commit/fafbc97f3a8cbaa1ac7be8f6c6d9d78e4cdcb928))
* add handling to point to correct babel rc ([0cf673f](https://github.com/smallcase/sc-fe-bite/commit/0cf673f9d5a7b45df842f0b6619bf9aa45280967))
* add logic to rename files ([e135355](https://github.com/smallcase/sc-fe-bite/commit/e1353556ad44b521a3fd501f115e4ab1506feac8))
* add moduleResolution Bundler to declaration generator ([1fdbbf5](https://github.com/smallcase/sc-fe-bite/commit/1fdbbf50761dc0f861d7059c24c02a36c4909482))
* add moduleResolution Bundler to declaration generator defaults ([8a10851](https://github.com/smallcase/sc-fe-bite/commit/8a108516d869ce2b31e93e086edcbc0a77f83819))
* add private to false ([e7168ae](https://github.com/smallcase/sc-fe-bite/commit/e7168ae8b8b22ddc64c36e85d59ab7033ff6ecf6))
* add support for types generation ([ddd8543](https://github.com/smallcase/sc-fe-bite/commit/ddd85432fc8d052cefc3ba7885258d9d0718503b))
* add support for watch mode ([69b172b](https://github.com/smallcase/sc-fe-bite/commit/69b172bf4d167723804e216b7e272984f97d6d99))
* add todo.md ([69c470f](https://github.com/smallcase/sc-fe-bite/commit/69c470f23f82a63daa10dc208553e049403768f6))
* add ts support ([f0605ef](https://github.com/smallcase/sc-fe-bite/commit/f0605ef9440132bf7301acbf9909fccbc41b6b58))
* add utils to mesaure time ([0dfbaec](https://github.com/smallcase/sc-fe-bite/commit/0dfbaec2a840d5e68627f4399460bce1c27a76d0))
* add witty mode ([8a3469d](https://github.com/smallcase/sc-fe-bite/commit/8a3469d3f85982bd053889af4ac9d91fa1335ec8))
* add yocto spinner for better ux ([9ed29df](https://github.com/smallcase/sc-fe-bite/commit/9ed29df5f4732a2092db61ab6d0cae3e7684dbb5))
* correct the babel config path ([7080bcf](https://github.com/smallcase/sc-fe-bite/commit/7080bcfdda30979ea70534c4a8be2e4547a77061))
* correct the babel config path ([e524423](https://github.com/smallcase/sc-fe-bite/commit/e524423107cf1c332ba8618db61f02ade6c70a88))
* downgrade chalk to 4 ([457ed93](https://github.com/smallcase/sc-fe-bite/commit/457ed9385fd419c124128a38a79c1dbe77083802))
* generate .d.ts files using ts native apis to optimise for time ([cdec966](https://github.com/smallcase/sc-fe-bite/commit/cdec96688421399a61ab67d9368d8c6d9b7c2fd6))
* json import issue ([88012fc](https://github.com/smallcase/sc-fe-bite/commit/88012fcb463e4facb3ead1ac08c5a97b0174e9cf))
* make src optional ([00eae8e](https://github.com/smallcase/sc-fe-bite/commit/00eae8e35f12537fc5a8e9f40aa14d17ed2df36b))
* migrate to esm ([1f0a6a2](https://github.com/smallcase/sc-fe-bite/commit/1f0a6a235fdb5a1409627e3e53a60d6b123ccfb8))
* optimize performance with parallel processes ([4ab81b3](https://github.com/smallcase/sc-fe-bite/commit/4ab81b39fb533cdbcc3339b1c3aa69e993b5ef4a))
* point to gh registry ([a4de276](https://github.com/smallcase/sc-fe-bite/commit/a4de2762bfe446e58bfce6a38960ad7a1340d011))
* remove type module ([d0b467d](https://github.com/smallcase/sc-fe-bite/commit/d0b467de9ec806ad22a37194aec90b1eeaaf133f))
* runtime errors thrown because of esm migration ([bf4cdf5](https://github.com/smallcase/sc-fe-bite/commit/bf4cdf528a51e1258d1ca213e9c6226351fb15da))
* separate cli and tools ([59cc35e](https://github.com/smallcase/sc-fe-bite/commit/59cc35ee161b188e538fa8fbbcce34532a8cfc7a))
* update meta ([9cdaf77](https://github.com/smallcase/sc-fe-bite/commit/9cdaf775c973d9c61a3ac42e7aa1a1f9a5e96261))
* update name ([a465d44](https://github.com/smallcase/sc-fe-bite/commit/a465d44c68e73509fdebbf54e5410499a2405669))
* update package name ([7c2c08f](https://github.com/smallcase/sc-fe-bite/commit/7c2c08f8a13c94318e6b23901d17381cd17a95d8))
* update readme ([db56ef8](https://github.com/smallcase/sc-fe-bite/commit/db56ef88fb487d344737da765c505cdfd7358410))
* update readme ([afb2b95](https://github.com/smallcase/sc-fe-bite/commit/afb2b95dbd01e2c009e7345f545ea70bb064b80b))
* update tsconfig to use chalk and type module ([1290442](https://github.com/smallcase/sc-fe-bite/commit/12904424d263e1d3ff415b5919955aab4c254cd6))
* use native babel package to transform files for perf optimisations ([291bf47](https://github.com/smallcase/sc-fe-bite/commit/291bf4721d14cd974e296d29d0365a2923ed9216))
* watch mode logic and add support for clean builds ([aab0e95](https://github.com/smallcase/sc-fe-bite/commit/aab0e95b5755b87f3a56ab9f74f2f50de2d9063e))
* watch mode re-enable ([068390d](https://github.com/smallcase/sc-fe-bite/commit/068390d87dcc375ddbf04ed85dafb39290dca289))
