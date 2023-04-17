'use strict';

module.exports = {
  rules: {
    'no-singleton-class-properties': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow custom properties in Singleton classes',
          category: 'Possible Errors',
          recommended: true,
        },
        schema: [],
        messages: {
          noCustomProperties:
            'Singleton classes cannot have custom properties. Use @Inject or make the property readonly.',
        },
      },
      create: function (context) {
        const isTypeScript = context.parserServices.hasFullTypeInformation;
        function checkForSingleton(node) {
          const isSingleton =
            node.decorators &&
            node.decorators.some(
              (decorator) => decorator.expression.name === 'Singleton'
            );
          if (!isSingleton) {
            return;
          }

          const hasCustomProperties = node.body.body.some(
            (property) =>
              !property.static && !property.readonly && !isInject(property)
          );
          if (hasCustomProperties) {
            context.report({
              node,
              messageId: 'noCustomProperties',
            });
          }
        }

        function isInject(property) {
          return (
            property.decorators &&
            property.decorators.some(
              (decorator) => decorator.expression.name === 'Inject'
            )
          );
        }

        return {
          ClassDeclaration: isTypeScript ? checkForSingleton : () => {},
        };
      },
      severity: 'warn',
    },
  },
};
