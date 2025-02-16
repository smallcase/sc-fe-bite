/**
 * function to generate the declaration files for a given folder
 * @param srcDir - the path of the directory for which we need to generate .d.ts
 * @param outDir - path where to output the generated declarations
 */
// function generateDeclaration(srcDir: string, outDir: string) {
//   const packageRoot = path.dirname(srcDir);
//   const packageTsConfig = path.resolve(packageRoot, 'tsconfig.json');
//   const globalPackageConfig = path.resolve(
//     __dirname,
//     '../tsconfig.package.json'
//   );

//   // Base Ts File which will be copied over to package
//   const tsconfigContent = JSON.stringify(
//     {
//       compilerOptions: {
//         outDir: outDir,
//         target: 'ESNext',
//         strict: true,
//         esModuleInterop: true,
//         declaration: true,
//         declarationMap: true,
//         emitDeclarationOnly: true,
//         skipLibCheck: true,
//         jsx: 'preserve',
//       },
//       include: [srcDir],
//     },
//     null,
//     2
//   );

//   let tsConfigToUse: string;
//   let tempConfig = false;

//   if (fs.existsSync(packageTsConfig)) {
//     tsConfigToUse = packageTsConfig;
//   } else if (fs.existsSync(globalPackageConfig)) {
//     tsConfigToUse = globalPackageConfig;
//   } else {
//     // If package doesn't have a ts config then add a temporary config to generate the declaration files
//     tsConfigToUse = path.join(packageRoot, 'tsconfig.temp.json');
//     tempConfig = true;
//     fs.writeFileSync(tsConfigToUse, tsconfigContent);
//   }

//   const spinner = yoctoSpinner({
//     spinner: {
//       interval: 125,
//       frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'],
//     },
//     text: chalk.blue(`Generating .d.ts files`),
//   }).start();

//   try {
//     execSync(
//       `npx tsc --emitDeclarationOnly --outDir ${outDir} --project ${tsConfigToUse}`,
//       { stdio: 'inherit' }
//     );

//     spinner.success(chalk.green('Generated .d.ts files'));
//   } catch (error) {
//     spinner.error(chalk.red('Generation of .d.ts failed'));
//     Logger.Error(`Error generating declaration files: ${error}`);
//   } finally {
//     // Clear out temp tsconfig file once types are generated
//     if (tempConfig) {
//       fs.unlinkSync(tsConfigToUse);
//     }
//   }
// }

// function transformToJavascript(srcDir: string, outDir: string) {
//   const babelCmd = `npx babel ${srcDir} --out-dir ${outDir} --config-file ${path.resolve(
//     __dirname,
//     '../../../babel.config.json'
//   )} --extensions ".ts,.tsx" --copy-files`;

//   const spinner = yoctoSpinner({
//     spinner: {
//       interval: 125,
//       frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'],
//     },
//     text: chalk.blue(`Transpiling Tsx to JS`),
//   }).start();

//   try {
//     execSync(babelCmd, { stdio: 'inherit' });
//     spinner.success(chalk.green('Transpilation completed!'));
//   } catch (error) {
//     spinner.error(chalk.red('Transpilation completed!'));
//     Logger.Error(`Error transpiling files:, ${error}`);
//     process.exit(1);
//   }
// }
