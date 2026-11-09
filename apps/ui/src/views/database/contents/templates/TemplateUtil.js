import Mustache from 'mustache';

const extractTemplateVariables = (html, templateVariables, templateParts) => {
  if (!html) {
    return [];
  }
  try {
    let result = Mustache.parse(html)
      .filter(function (v) {
        return v[0] === 'name' || v[0] === '&' || v[0] === '#' || v[0] === '^';
      })
      .filter(function (v) {
        return v[1].indexOf('content.') === 0;
      })
      .map(function (v) {
        return v[1].substring('content.'.length);
      });

    let variables = { template_part: {}, content: templateVariables };
    if (templateParts) {
      for (let contentTemplatePart of templateParts) {
        variables.template_part[contentTemplatePart.uid] = () => {
          return contentTemplatePart.html;
        };
      }
    }

    let newHtml = Mustache.render(html, variables);
    if (newHtml !== html) {
      let newResult = extractTemplateVariables(newHtml, templateVariables, templateParts);
      result = [...result, ...newResult];
    }
    result = [...new Set(result)].filter((item) => {
      return item && item.length > 0;
    });

    return result;
  } catch {
    return [];
  }
};

export { extractTemplateVariables };
