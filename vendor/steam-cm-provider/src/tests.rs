use std::sync::Arc;

use super::*;

#[tokio::test]
async fn test_concurrent_cache_access() {
    let mut builder = HttpCmServerProvider::builder().http(Arc::new(ReqwestHttpClient::new()) as Arc<dyn HttpClient>).rng(Arc::new(DefaultRng) as Arc<dyn CmRng>);

    builder = builder.cache_path(std::env::temp_dir().join("test_concurrent_cache_access.json"));

    let provider: Arc<HttpCmServerProvider<Arc<dyn HttpClient>, Arc<dyn CmRng>>> = Arc::new(builder.build());

    let servers = vec![CmServer {
        endpoint: "test.endpoint:443".to_string(),
        legacy_endpoint: "test.endpoint:443".to_string(),
        server_type: "websockets".to_string(),
        dc: "test".to_string(),
        load: 1.0,
        realm: "steamglobal".to_string(),
    }];

    // Launch multiple tasks to save/load simultaneously
    let mut handlers = Vec::new();
    for i in 0..20 {
        let p = provider.clone();
        let s = servers.clone();
        handlers.push(tokio::spawn(async move {
            if i % 2 == 0 {
                p.save_to_disk(s).await;
            } else {
                let _ = p.load_from_disk().await;
            }
        }));
    }

    for h in handlers {
        h.await.unwrap();
    }
}

#[tokio::test]
async fn test_concurrent_get_server_cache_hit() {
    let mut builder = HttpCmServerProvider::builder().http(Arc::new(ReqwestHttpClient::new()) as Arc<dyn HttpClient>).rng(Arc::new(DefaultRng) as Arc<dyn CmRng>);

    builder = builder.cache_path(std::env::temp_dir().join("test_concurrent_get_server_cache_hit.json"));

    let provider: Arc<HttpCmServerProvider<Arc<dyn HttpClient>, Arc<dyn CmRng>>> = Arc::new(builder.build());

    let servers = vec![CmServer {
        endpoint: "test.endpoint:443".to_string(),
        legacy_endpoint: "test.endpoint:443".to_string(),
        server_type: "websockets".to_string(),
        dc: "test".to_string(),
        load: 1.0,
        realm: "steamglobal".to_string(),
    }];

    // Warm up cache
    provider.save_to_disk(servers).await;

    // Launch multiple tasks to get_server simultaneously
    let mut handlers = Vec::new();
    for _ in 0..50 {
        let p = provider.clone();
        handlers.push(tokio::spawn(async move {
            let res = p.get_server().await;
            assert!(res.is_ok());
        }));
    }

    for h in handlers {
        h.await.unwrap();
    }
}
