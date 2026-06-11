export const injectJson = async (app, {
  method = "GET",
  url,
  token,
  headers = {},
  payload,
}) => {
  const response = await app.inject({
    method,
    url,
    headers: {
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: token } : {}),
      ...headers,
    },
    payload,
  });

  let body;
  try {
    body = response.body ? JSON.parse(response.body) : null;
  } catch {
    body = response.body;
  }

  return {
    response,
    statusCode: response.statusCode,
    body,
  };
};
