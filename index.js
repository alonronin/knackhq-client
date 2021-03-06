"use strict";

const _ = require("lodash");
const redirects = require("follow-redirects");
const http_client = redirects.https;

module.exports = class KnackHQClient {
  constructor(options) {
    this.host = "api.knack.com";
    this.token = options.token;
    this.app_id = options.app_id;
    this.api_key = options.api_key;
    this.api_version = "v1";
  }

  async request_async(options) {
    return new Promise((resolve, reject) => {
      const request = http_client.request(options, response => {
        if (!response || !response.on) {
          return reject();
        }

        let document_text = "";

        response.on("data", chunk => {
          document_text += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(document_text));
          } catch (error) {
            reject({
              error,
              body: document_text
            });
          }
        });
      });

      request.on("error", reject);

      if (options.body) {
        request.write(JSON.stringify(options.body));
      }

      request.end();
    });
  }

  async request(options) {
    const request_options = {
      host: this.host,
      path: `/v1/${options.path}`,
      port: 443,
      headers: {
        "X-Knack-Application-Id": this.app_id,
        "Content-Type": "application/json"
      }
    };

    request_options.method = options.method;

    if (options.body) {
      request_options.method = "POST";
      request_options.body = options.body;
    }

    if (this.token) {
      request_options.headers["Authorization"] = this.token;
    } else if (this.api_key) {
      request_options.headers["X-Knack-REST-API-Key"] = this.api_key;
    }

    return this.request_async(request_options);
  }

  async authenticate(email, password) {
    if (!email || !password) {
      return;
    }

    return this.request({
      body: {
        email,
        password
      },
      path: `applications/${this.app_id}/session`
    }).then(
      _.bind(function(data) {
        return (this.token = data.session.user.token);
      }, this)
    );
  }

  async objects() {
    return this.request({
      path: "objects"
    });
  }

  async records(object_key) {
    return this.request({
      path: `objects/${object_key}/records`
    });
  }

  async getRecord(object_key, record_key) {
    return this.request({
      path: `objects/${object_key}/records/${record_key}`
    });
  }

  async createRecord(object_key, body) {
    return this.request({
      path: `objects/${object_key}/records`,
      body: body
    });
  }

  async deleteRecord(object_key, record_key) {
    return this.request({
      path: `objects/${object_key}/records/${record_key}`,
      method: "DELETE"
    });
  }

  async updateRecord(object_key, record_key, body) {
    return this.request({
      path: "objects/${object_key}/records/${record_key}",
      method: "PUT",
      body: body
    });
  }

  async findRecord(object_key, filters, page, rows_per_page) {
    return this.request({
      path:
        "objects/" +
        object_key +
        "/records" +
        (filters
          ? "?filters=" + encodeURIComponent(JSON.stringify(filters))
          : "") +
        (rows_per_page
          ? (filters ? "&" : "?") + "rows_per_page=" + rows_per_page
          : "") +
        (page ? (filters || rows_per_page ? "&" : "?") + "page=" + page : "")
    });
  }

  async upload(object_key, field_key, filename, body) {
    return this.request({
      path: `applications/${this.app_id}/assets/file/upload`,
      body: _.extend({}, body)
    })
      .then(result => {
        const file_body = _.extend({}, body);
        file_body[field_key] = result.id;

        return {
          path: `objects/${object_key}/records`,
          body: file_body
        };
      })
      .then(this.request);
  }
};
