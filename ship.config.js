const execa = require(require.resolve('execa'));
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const read = promisify(fs.readFile);
const write = fs.writeFileSync;

function extractSpecificChangelog(changelog, version) {
    if (!changelog) {
        return null
    }
    const escapedVersion = version.replace(/\./g, '\\.')
    const regex = new RegExp(
        `(#+?\\s\\[?v?${escapedVersion}\\]?[\\s\\S]*?)(#+?\\s\\[?v?\\d\\.\\d\\.\\d\\]?)`,
        'g'
    );
    const matches = regex.exec(changelog);
    return matches ? matches[1] : null
}

async function commitChangelog(current, next) {
    const { stdout } = await execa('npx', ['lerna-changelog', '--next-version', `v${next}`]);
    const escapedVersion = next.replace(/\./g, '\\.');
    const regex = new RegExp(
        `(#+?\\s\\[?v?${escapedVersion}\\]?[\\s\\S]*?)(#+?\\s\\[?v?\\d\\.\\d\\.\\d\\]?)`,
        'g'
    );
    const matches = regex.exec(stdout.toString());
    const head = matches ? matches[1] : stdout;
    const changelog = await read('./CHANGELOG.md', 'utf8');
    return write('./CHANGELOG.md', `${head}\n\n${changelog}`)
}

module.exports = {
    mergeStrategy: { toSameBranch: ['master'] },
    monorepo: {
        mainVersionFile: "lerna.json",
        packagesToBump: ["packages/*"],
        packagesToPublish: ["packages/*"]
    },
    getNextVersion: (revisionRange,
                     currentVersion,
                     dir) => {
        console.log("getNextVersion");
        console.log(revisionRange, currentVersion, dir)
    },
    updateChangelog: false,
    beforeCommitChanges: ({ nextVersion, exec, dir }) => {
        return new Promise(resolve => {
            const pkg = require('./lerna.json');
            commitChangelog(pkg.version, nextVersion).then(resolve)
        })
    },
    publishCommand: ({ isYarn, tag, defaultCommand, dir }) => {
        // Always use npm
        return `npx can-npm-publish && npm publish --tag ${tag} || echo "Does not publish"`
    },
    releases: {
        extractChangelog: ({ version, dir }) => {
            const changelogPath = path.resolve(dir, 'CHANGELOG.md');
            try {
                const changelogFile = fs.readFileSync(changelogPath, 'utf-8').toString();
                return extractSpecificChangelog(changelogFile, version)
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return null
                }
                throw err
            }
        }
    }
};
