const response = {
  send: (values, res) => {
    res.json(values);
    res.end();
  },

  ok: (values, res, message, fields) => {
    const data = {
      success: true,
      status: 200,
      data: values,
      message,
      fields,
    };
    res.json(data);
    res.end();
  },

  back: (code, values, message, fields) => {
    const data = {
      status: code,
      data: values,
      message,
      fields,
    };
    return data;
  },

  success: (res, fields) => {
    const data = {
      success: true,
      status: 201,
      data: null,
      message: `Success with empty data`,
      fields,
    };
    res.json(data);
    res.end();
  },

  error: (status, message, res, err, fields) => {
    const data = {
      success: false,
      status,
      message,
      err,
      fields,
    };
    res.json(data);
    res.end();
  },

  done: (message, res, token) => {
    const data = {
      success: true,
      status: 200,
      message,
      token,
    };
    res.json(data);
    res.end();
  },

  redirect: (url, res) => {
    res.redirect(url);
  },

  unauthorized: (data, res, message) => {
    return res.status(401).json({
      success: false,
      message: message || "Unauthorized",
      data: data || null,
    });
  },

  gagal: (status, message, res, err = {}) => {
    res.status(status).send({ success: false, status, message, err });
  },

  badRequest: (data, res, message) => {
    return res.status(400).json({
      status: false,
      message,
      data,
    });
  },
};

export default response;
