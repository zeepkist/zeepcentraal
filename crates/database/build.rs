fn main() {
    // Embedded SQL must rebuild migrate/jobs/server when migration contents change.
    println!("cargo:rerun-if-changed=migrations");
}
