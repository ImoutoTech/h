import dataSource from './data-source';

type MigrationAction = 'run' | 'revert';

async function execute(action: MigrationAction) {
  try {
    await dataSource.initialize();
    if (action === 'run') {
      await dataSource.runMigrations({ transaction: 'all' });
    } else {
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    process.stdout.write(`Migration ${action} completed\n`);
  } catch {
    // TypeORM query errors include SQL parameters. Do not pass the error
    // object to console or the CLI because migration parameters can be secrets.
    process.stderr.write(
      `Migration ${action} failed; inspect database state safely\n`,
    );
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

const action = process.argv[2];
if (action !== 'run' && action !== 'revert') {
  process.stderr.write('Expected migration action: run or revert\n');
  process.exitCode = 1;
} else {
  void execute(action);
}
