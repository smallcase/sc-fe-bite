import chalk from 'chalk';

function LogManager() {
  function Success(message: string) {
    console.log(chalk.green(`✅ ${message}`));
  }

  function Error(message: string) {
    console.error(chalk.red(`❌ ${message}`));
  }

  function Warning(message: string) {
    console.log(chalk.yellow(`🚧 ${message}`));
  }

  function Info(message: string) {
    console.info(chalk.blue(`🦄 ${message}`));
  }

  function Completion(message: string) {
    console.log(chalk.greenBright(`🦄 ${message}`));
  }

  return {
    Success,
    Error,
    Warning,
    Info,
    Completion,
  };
}

const Logger = LogManager();

export { Logger };
