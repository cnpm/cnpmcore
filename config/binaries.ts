type BinaryTaskConfig = {
  category: string;
  syncer: string;
  repo: string;
};

const binaries: BinaryTaskConfig[] = [
  {
    category: 'node',
    syncer: 'NodeBinary',
    repo: 'nodejs/node',
  },
  {
    category: 'electron',
    syncer: 'GithubBinary',
    repo: 'electron/electron',
  },
  {
    category: 'node-sass',
    syncer: 'GithubBinary',
    repo: 'sass/node-sass',
  },
];

export default binaries;
