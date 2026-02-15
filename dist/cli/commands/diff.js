import { Command } from 'commander';
export const diffCommand = new Command('diff')
    .description('Compare two scan results')
    .argument('<scan1>', 'First scan result JSON file')
    .argument('<scan2>', 'Second scan result JSON file')
    .option('-o, --output <path>', 'Output file path for diff result')
    .action(async (_scan1, _scan2, _options) => {
    console.log('⚠️  Diff command coming in Week 5 (result comparison)');
    process.exit(0);
});
//# sourceMappingURL=diff.js.map