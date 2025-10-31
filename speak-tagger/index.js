const esbuild = require('esbuild');

function componentTagger() {
  return {
    name: 'speak-tagger',
    transform(code, id) {
      if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
        // Add a comment to tag components
        const taggedCode = `// Tagged by S.P.E.A.K. Tagger\n${code}`;
        return {
          code: taggedCode,
          map: null
        };
      }
    }
  };
}

module.exports = { componentTagger };
