// tocbot

var
  contentSelector = '#content',
  headingsSelector = 'h1, h2, h3, h4',
  content = document.querySelector(contentSelector),
  headings = content.querySelectorAll(headingsSelector),
  headingMap = {};

for (var i = 0, len = headings.length; i < len; i++) {
  var
    heading = headings[i],
    id = heading.id ? heading.id :
      heading.textContent.trim().toLowerCase().split(/\s+/).join('-').replace(/[^-_a-z0-9]+/g, '');

  if (id.length > 32) id = id.substring(0, id.indexOf('-', 28));
  headingMap[id] = !isNaN(headingMap[id]) ? ++headingMap[id] : 0;
  if (headingMap[id]) id += '-' + headingMap[id];

  heading.id = id;
}

tocbot.init({
  tocSelector: '#toc',
  contentSelector: contentSelector,
  headingSelector: headingsSelector,
});


// monaco

require.config({ paths: { 'vs': './node_modules/monaco-editor/min/vs' } });
require(['vs/editor/editor.main'], function () {

  var
    ts = monaco.languages.typescript,
    tsDefs = ts.typescriptDefaults;

  tsDefs.setCompilerOptions({ strict: true, target: ts.ScriptTarget.ES2017 });
  for (var file in files) tsDefs.addExtraLib(files[file], `file:///${file}`);

  const
    commonOpts = {
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
      },
      fontFamily: 'source-code-pro',
      fontSize: 15,
      lineNumbers: 'off',
    },
    runnables = document.getElementsByClassName('runnable');

  let i = 1;
  for (var runnable of runnables) {
    var
      uri = monaco.Uri.parse(`file:///main.${i++}.ts`),
      js = runnable.innerText.trim(),
      model = monaco.editor.createModel(js, 'typescript', uri),
      opts = { model, ...commonOpts };

    runnable.innerText = '';
    runnable.style.height = String(js.split('\n').length * 24) + 'px';
    monaco.editor.create(runnable, opts);
  }
});