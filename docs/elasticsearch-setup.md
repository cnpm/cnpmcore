# WIP 本地搭建 ES 搜索环境

## 下载安装 ES

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

## 下载安装 Kibana

为了更方便的使用 ES，我们还需要再安装其可视化的数据操作和分析工具 Kibana。 ES 有对应版本的 Kibana 下载地址，这里同理进入 Kibana 的 [官方下载地址](https://www.elastic.co/cn/downloads/kibana) ，当前版本为 8.6.1。

下载完成后进入 kibana-8.6.1 的文件目录并启动它

```bash
./bin/kibana
```

此时，访问 http://localhost:5601 ，即可看到 Kibana 引导页面。


我们仅仅将其作为一个可视化的操作 API 的可视化工具，可以跳过其引导，访问 `/app/dev_tools#/console` 进入 devtool 页面。



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
  "dynamic": "false",
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
  "dynamic": "false",
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
        "lastestVersionTime": {
          "type": "long"
        },
        "latestVersionTime": {
          "type": "long"
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
  enableElasticsearch: true,
  // 写入索引，与上述创建索引一致
  elasticsearchIndex: 'cnpmcore_packages',
}
```

### 尝试写入或同步一条数据

1. 手动写入

```bash
$ curl --location --request GET http://localhost:7001/-/v1/search/sync/colors
```

2. 开启同步

```bash
$ curl --location --request PUT 'http://localhost:7001/-/package/colors/syncs'
```bash

### 查询

```bash
$ npm search colors --registry http://localhost:7001
```