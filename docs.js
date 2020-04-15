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
