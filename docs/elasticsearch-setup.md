# 本地搭建 ES 搜索环境

## 单机搭建
### 下载安装 ES

首先我们进入 [ES 下载的官方网站](https://www.elastic.co/cn/downloads/elasticsearch) ，选择合适的操作系统版本并下载。下载完成后再适当位置解压并运行

```bash
cd ~/your_path/elaticsearch-8.6.1./bin/elasticsearch
```

ES 默认的 http.port 端口为 `9200`，此时我们访问 `localhost:9200` 时会可能会抛出证书的异常。

这所因为 ES 默认的自签名证书不被系统所信任。我们可以在当前命令的目录下找到其配置文件 `config.elaticsearch.yml`，在开发阶段先将其关闭。

```yaml
# Enable security features
xpack.security.enabled: false
```

此外，为了更方便查看 ES 的数据和日志的目录，我们也将其修改为当前目录

```yaml
# Path to directory where to store the data (separate multiple locations by comma):
#
path.data: ./data
#
# Path to log files:
#
path.logs: ./logs
```

再次重启 ES

```bash
./bin/elasticsearch
```

此时我们访问 [localhost:9200](http://localhost:9200)，可以看到当前 ES 集群的详细信息。

### 下载安装 Kibana

为了更方便的使用 ES，我们还需要再安装其可视化的数据操作和分析工具 Kibana。 ES 有对应版本的 Kibana 下载地址，这里同理进入 Kibana 的 [官方下载地址](https://www.elastic.co/cn/downloads/kibana) ，当前版本为 8.6.1。

下载完成后进入 kibana-8.6.1 的文件目录并启动它

```bash
./bin/kibana
```

此时，访问 http://localhost:5601 ，即可看到 Kibana 引导页面。


我们仅仅将其作为一个可视化的操作 API 的可视化工具，可以跳过其引导，访问 `/app/dev_tools#/console` 进入 devtool 页面。

## docker compose

新建文件 `docker-compose.yaml`， 复制如下的 `docker-compose.yaml`

```yaml
version: "3.8"

volumes:
  certs:
    driver: local
  esdata01:
    driver: local
  kibanadata:
    driver: local

services:
  setup:
    image: docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION}
    volumes:
      - certs:/usr/share/elasticsearch/config/certs
    user: "0"
    command: >
      bash -c '
        if [ x${ELASTIC_PASSWORD} == x ]; then
          echo "Set the ELASTIC_PASSWORD environment variable in the .env file";
          exit 1;
        elif [ x${KIBANA_PASSWORD} == x ]; then
          echo "Set the KIBANA_PASSWORD environment variable in the .env file";
          exit 1;
        fi;
        if [ ! -f config/certs/ca.zip ]; then
          echo "Creating CA";
          bin/elasticsearch-certutil ca --silent --pem -out config/certs/ca.zip;
          unzip config/certs/ca.zip -d config/certs;
        fi;
        if [ ! -f config/certs/certs.zip ]; then
          echo "Creating certs";
          echo -ne \
          "instances:\n"\
          "  - name: es01\n"\
          "    dns:\n"\
          "      - es01\n"\
          "      - localhost\n"\
          "    ip:\n"\
          "      - 127.0.0.1\n"\
          "  - name: kibana\n"\
          "    dns:\n"\
          "      - kibana\n"\
          "      - localhost\n"\
          "    ip:\n"\
          "      - 127.0.0.1\n"\
          > config/certs/instances.yml;
          bin/elasticsearch-certutil cert --silent --pem -out config/certs/certs.zip --in config/certs/instances.yml --ca-cert config/certs/ca/ca.crt --ca-key config/certs/ca/ca.key;
          unzip config/certs/certs.zip -d config/certs;
        fi;
        echo "Setting file permissions"
        chown -R root:root config/certs;
        find . -type d -exec chmod 750 \{\} \;;
        find . -type f -exec chmod 640 \{\} \;;
        echo "Waiting for Elasticsearch availability";
        until curl -s --cacert config/certs/ca/ca.crt http://es01:9200 | grep -q "missing authentication credentials"; do sleep 30; done;
        echo "Setting kibana_system password";
        until curl -s -X POST --cacert config/certs/ca/ca.crt -u "elastic:${ELASTIC_PASSWORD}" -H "Content-Type: application/json" http://es01:9200/_security/user/kibana_system/_password -d "{\"password\":\"${KIBANA_PASSWORD}\"}" | grep -q "^{}"; do sleep 10; done;
        echo "All done!";
      '
    healthcheck:
      test: ["CMD-SHELL", "[ -f config/certs/es01/es01.crt ]"]
      interval: 1s
      timeout: 5s
      retries: 120

  es01:
    depends_on:
      setup:
        condition: service_healthy
    image: docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION}
    labels:
      co.elastic.logs/module: elasticsearch
    volumes:
      - certs:/usr/share/elasticsearch/config/certs
      - esdata01:/usr/share/elasticsearch/data
    ports:
      - ${ES_PORT}:9200
    environment:
      - node.name=es01
      - cluster.name=${CLUSTER_NAME}
      - discovery.type=single-node
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
      - bootstrap.memory_lock=true
      - xpack.security.enabled=true
      - xpack.security.http.ssl.enabled=false
      - xpack.security.http.ssl.key=certs/es01/es01.key
      - xpack.security.http.ssl.certificate=certs/es01/es01.crt
      - xpack.security.http.ssl.certificate_authorities=certs/ca/ca.crt
      - xpack.security.transport.ssl.enabled=false
      - xpack.security.transport.ssl.key=certs/es01/es01.key
      - xpack.security.transport.ssl.certificate=certs/es01/es01.crt
      - xpack.security.transport.ssl.certificate_authorities=certs/ca/ca.crt
      - xpack.security.transport.ssl.verification_mode=certificate
      - xpack.license.self_generated.type=${LICENSE}
    mem_limit: ${ES_MEM_LIMIT}
    ulimits:
      memlock:
        soft: -1
        hard: -1
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "curl -s --cacert config/certs/ca/ca.crt http://localhost:9200 | grep -q 'missing authentication credentials'",
        ]
      interval: 10s
      timeout: 10s
      retries: 120

  kibana:
    depends_on:
      es01:
        condition: service_healthy
    image: docker.elastic.co/kibana/kibana:${STACK_VERSION}
    labels:
      co.elastic.logs/module: kibana
    volumes:
      - certs:/usr/share/kibana/config/certs
      - kibanadata:/usr/share/kibana/data
    ports:
      - ${KIBANA_PORT}:5601
    environment:
      - SERVERNAME=kibana
      - ELASTICSEARCH_HOSTS=http://es01:9200
      - ELASTICSEARCH_USERNAME=kibana_system
      - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
      - ELASTICSEARCH_SSL_CERTIFICATEAUTHORITIES=config/certs/ca/ca.crt
      - XPACK_SECURITY_ENCRYPTIONKEY=${ENCRYPTION_KEY}
      - XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY=${ENCRYPTION_KEY}
      - XPACK_REPORTING_ENCRYPTIONKEY=${ENCRYPTION_KEY}
    mem_limit: ${KB_MEM_LIMIT}
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "curl -s -I http://localhost:5601 | grep -q 'HTTP/1.1 302 Found'",
        ]
      interval: 10s
      timeout: 10s
      retries: 120
```

### 新建 .env 文件

复制如下的 `.env` 文件

```bash
# Password for the 'elastic' user (at least 6 characters)
ELASTIC_PASSWORD="abcdef"

# Password for the 'kibana_system' user (at least 6 characters)
KIBANA_PASSWORD="abcdef"

# Version of Elastic products
STACK_VERSION=8.7.1

# Set the cluster name
CLUSTER_NAME=docker-cluster

# Set to 'basic' or 'trial' to automatically start the 30-day trial
LICENSE=basic
#LICENSE=trial

# Port to expose Elasticsearch HTTP API to the host
ES_PORT=9200
#ES_PORT=127.0.0.1:9200

# Port to expose Kibana to the host
KIBANA_PORT=5601
#KIBANA_PORT=80

# Increase or decrease based on the available host memory (in bytes)
ES_MEM_LIMIT=1073741824
KB_MEM_LIMIT=1073741824
LS_MEM_LIMIT=1073741824

# Project namespace (defaults to the current folder name if not set)
#COMPOSE_PROJECT_NAME=myproject

# SAMPLE Predefined Key only to be used in POC environments
ENCRYPTION_KEY=c34d38b3a14956121ff2170e5030b471551370178f43e5626eec58b04a30fae2
```

### 启动服务

执行如下命令，启动服务

```bash
$ docker compose up
```

### 访问 Elastic

浏览器打开 http://localhost:5601/app/dev_tools#/console，默认账号为 `elastic` 密码为 .env 文件中定义的 `abcdef`


## 创建索引

ES 可以通过 Kibana devtool 进行数据的写入和查询操作。下面创建一个索引，`cnpmcore_packages` 为索引名称。

```json
PUT cnpmcore_packages
{
  "settings": ${settings} // copy 下方 settings
  "mappings": ${mappings} // copy 下方 settings
}
```

### settings

```json
{
  "index": {
    "analysis": {
      "analyzer": {
        "package": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_autocomplete": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "autocomplete",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_autocomplete_highlight": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "trim"
          ],
          "tokenizer": "autocomplete"
        },
        "package_autocomplete_keyword": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "autocomplete",
            "trim",
            "unique_on_same_position"
          ],
          "tokenizer": "keyword"
        },
        "package_autocomplete_keyword_search": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "trim"
          ],
          "tokenizer": "keyword"
        },
        "package_edge_ngram": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "edge_ngram",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_english": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "kstem",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_english_aggressive": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "porter_stem",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "raw": {
          "filter": [
            "asciifolding",
            "lowercase",
            "trim"
          ],
          "tokenizer": "keyword"
        }
      },
      "filter": {
        "autocomplete": {
          "max_gram": "15",
          "min_gram": "1",
          "type": "edge_ngram"
        },
        "edge_ngram": {
          "max_gram": "15",
          "min_gram": "4",
          "type": "edge_ngram"
        },
        "non_alfanum_to_space": {
          "pattern": "(?i)[^a-z0-9]+",
          "replacement": " ",
          "type": "pattern_replace"
        },
        "split_word": {
          "catenate_all": "false",
          "catenate_numbers": "false",
          "catenate_words": "false",
          "generate_number_parts": "true",
          "generate_word_parts": "true",
          "preserve_original": "true",
          "split_on_case_change": "true",
          "split_on_numerics": "true",
          "stem_english_possessive": "true",
          "type": "word_delimiter"
        },
        "unique_on_same_position": {
          "only_on_same_position": "false",
          "type": "unique"
        }
      },
      "normalizer": {
        "raw": {
          "filter": [
            "asciifolding",
            "lowercase",
            "trim"
          ],
          "type": "custom"
        }
      },
      "tokenizer": {
        "autocomplete": {
          "max_gram": "15",
          "min_gram": "1",
          "token_chars": [
            "letter",
            "digit"
          ],
          "type": "edge_ngram"
        }
      }
    }
  }
}
```

### mappings

```json
{
  "dynamic": true,
  "properties": {
    "downloads": {
      "properties": {
        "all": {
          "type": "long"
        }
      }
    },
    "package": {
      "properties": {
        "_rev": {
          "index": false,
          "type": "text"
        },
        "author": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "url": {
              "index": false,
              "type": "text"
            },
            "username": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "created": {
          "type": "date"
        },
        "description": {
          "fields": {
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "dist-tags": {
          "dynamic": "true",
          "enabled": false,
          "type": "object"
        },
        "keywords": {
          "fields": {
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "raw": {
              "analyzer": "raw",
              "type": "text"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "license": {
          "type": "keyword"
        },
        "maintainers": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "username": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "modified": {
          "type": "date"
        },
        "_source_registry_name": {
          "type": "text"
        },
        "_npmUser": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "publish_time": {
          "type": "long"
        },
        "name": {
          "fields": {
            "autocomplete": {
              "analyzer": "package_autocomplete",
              "search_analyzer": "package",
              "type": "text"
            },
            "autocomplete_highlight": {
              "analyzer": "package_autocomplete_highlight",
              "index_options": "offsets",
              "search_analyzer": "package",
              "type": "text"
            },
            "autocomplete_keyword": {
              "analyzer": "package_autocomplete_keyword",
              "search_analyzer": "package_autocomplete_keyword_search",
              "type": "text"
            },
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "raw": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "scope": {
          "normalizer": "raw",
          "type": "keyword"
        },
        "versions": {
          "index": false,
          "type": "text"
        }
      }
    }
  }
}
```

### 在 kibana 操作

```json
PUT /cnpmcore_packages
{
  "settings": {
  "index": {
    "analysis": {
      "analyzer": {
        "package": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_autocomplete": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "autocomplete",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_autocomplete_highlight": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "trim"
          ],
          "tokenizer": "autocomplete"
        },
        "package_autocomplete_keyword": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "autocomplete",
            "trim",
            "unique_on_same_position"
          ],
          "tokenizer": "keyword"
        },
        "package_autocomplete_keyword_search": {
          "filter": [
            "asciifolding",
            "non_alfanum_to_space",
            "lowercase",
            "trim"
          ],
          "tokenizer": "keyword"
        },
        "package_edge_ngram": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "edge_ngram",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_english": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "kstem",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "package_english_aggressive": {
          "filter": [
            "asciifolding",
            "split_word",
            "lowercase",
            "porter_stem",
            "unique_on_same_position"
          ],
          "tokenizer": "standard"
        },
        "raw": {
          "filter": [
            "asciifolding",
            "lowercase",
            "trim"
          ],
          "tokenizer": "keyword"
        }
      },
      "filter": {
        "autocomplete": {
          "max_gram": "15",
          "min_gram": "1",
          "type": "edge_ngram"
        },
        "edge_ngram": {
          "max_gram": "15",
          "min_gram": "4",
          "type": "edge_ngram"
        },
        "non_alfanum_to_space": {
          "pattern": "(?i)[^a-z0-9]+",
          "replacement": " ",
          "type": "pattern_replace"
        },
        "split_word": {
          "catenate_all": "false",
          "catenate_numbers": "false",
          "catenate_words": "false",
          "generate_number_parts": "true",
          "generate_word_parts": "true",
          "preserve_original": "true",
          "split_on_case_change": "true",
          "split_on_numerics": "true",
          "stem_english_possessive": "true",
          "type": "word_delimiter"
        },
        "unique_on_same_position": {
          "only_on_same_position": "false",
          "type": "unique"
        }
      },
      "normalizer": {
        "raw": {
          "filter": [
            "asciifolding",
            "lowercase",
            "trim"
          ],
          "type": "custom"
        }
      },
      "tokenizer": {
        "autocomplete": {
          "max_gram": "15",
          "min_gram": "1",
          "token_chars": [
            "letter",
            "digit"
          ],
          "type": "edge_ngram"
        }
      }
    }
  }
},
  "mappings": {
  "dynamic": true,
  "properties": {
    "downloads": {
      "properties": {
        "all": {
          "type": "long"
        }
      }
    },
    "package": {
      "properties": {
        "_rev": {
          "index": false,
          "type": "text"
        },
        "author": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "url": {
              "index": false,
              "type": "text"
            },
            "username": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "created": {
          "type": "date"
        },
        "description": {
          "fields": {
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "dist-tags": {
          "dynamic": "true",
          "enabled": false,
          "type": "object"
        },
        "keywords": {
          "fields": {
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "raw": {
              "analyzer": "raw",
              "type": "text"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "license": {
          "type": "keyword"
        },
        "maintainers": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "modified": {
          "type": "date"
        },
        "_source_registry_name": {
          "type": "text"
        },
        "_npmUser": {
          "properties": {
            "email": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "name": {
              "normalizer": "raw",
              "type": "keyword"
            }
          }
        },
        "publish_time": {
          "type": "long"
        },
        "name": {
          "fields": {
            "autocomplete": {
              "analyzer": "package_autocomplete",
              "search_analyzer": "package",
              "type": "text"
            },
            "autocomplete_highlight": {
              "analyzer": "package_autocomplete_highlight",
              "index_options": "offsets",
              "search_analyzer": "package",
              "type": "text"
            },
            "autocomplete_keyword": {
              "analyzer": "package_autocomplete_keyword",
              "search_analyzer": "package_autocomplete_keyword_search",
              "type": "text"
            },
            "edge_ngram": {
              "analyzer": "package_edge_ngram",
              "search_analyzer": "package",
              "type": "text"
            },
            "english": {
              "analyzer": "package_english",
              "type": "text"
            },
            "english_aggressive": {
              "analyzer": "package_english_aggressive",
              "type": "text"
            },
            "raw": {
              "normalizer": "raw",
              "type": "keyword"
            },
            "standard": {
              "analyzer": "standard",
              "type": "text"
            }
          },
          "type": "text"
        },
        "scope": {
          "normalizer": "raw",
          "type": "keyword"
        },
        "versions": {
          "index": false,
          "type": "text"
        }
      }
    }
  }
}
}
```

## 开启 cnpmcore 中的 ES 服务

```ts
// config.default.ts
config: {
  cnpmcore: {
    enableElasticsearch: true,
    // 写入索引，与上述创建索引一致
    elasticsearchIndex: 'cnpmcore_packages',
  },
  // elasticsearch 插件的 config，参考官方文档
  // https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html
  elasticsearch: {
    client: {
      node: 'http://localhost:9200',
      auth: {
        username: 'elastic',
        password: 'abcdef',
      },
    },
  };
}
```

### 同步一条数据

```bash
$ curl -X PUT https://r.cnpmjs.org/-/v1/search/sync/${pkgName}
```

### 删除一条数据

注意需要添加管理员 token，管理员在本地进行登录后，可通过查询 `~/.npmrc` 查看
```bash
$ curl -X DELETE -H 'Authorization: Bearer ${token}' http://localhost:7001/-/v1/search/${pkgName}
```

### 修改数据

创建同步任务即可，会自动进行覆盖式同步

### 查询

```bash
$ npm search colors --registry=http://localhost:7001
```
