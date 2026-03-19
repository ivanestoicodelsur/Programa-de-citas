export function validate(schema) {
  return (req, _res, next) => {
    try {
      const result = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      req.body = result.body;
      req.params = result.params;
      req.query = result.query;
      next();
    } catch (error) {
      next(error);
    }
  };
}
