// Neo4j Initialization Script
// Legal AI Platform Graph Database Setup

// Create basic indexes and constraints for common node types
CREATE CONSTRAINT contract_id_unique IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT tenant_id_unique IF NOT EXISTS FOR (t:Tenant) REQUIRE t.id IS UNIQUE;

// Create indexes for frequently queried properties
CREATE INDEX contract_status_idx IF NOT EXISTS FOR (c:Contract) ON (c.status);
CREATE INDEX document_type_idx IF NOT EXISTS FOR (d:Document) ON (d.type);
CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email);
CREATE INDEX tenant_name_idx IF NOT EXISTS FOR (t:Tenant) ON (t.name);

// Create full-text search indexes
CREATE FULLTEXT INDEX contract_search IF NOT EXISTS 
FOR (c:Contract) ON EACH [c.title, c.content, c.summary];

CREATE FULLTEXT INDEX document_search IF NOT EXISTS 
FOR (d:Document) ON EACH [d.title, d.content, d.summary];

// Create initial system nodes
MERGE (sys:System {id: 'legal-ai-platform', name: 'Legal AI Platform', version: '1.0.0'})
ON CREATE SET sys.created_at = datetime(), sys.status = 'initialized'
ON MATCH SET sys.last_updated = datetime();

// Note: Health check procedure would require APOC plugin
// For now, we'll skip this and rely on basic Cypher queries

// Create sample relationship types (will be populated by application)
// These are just for initial schema setup
MATCH (sys:System {id: 'legal-ai-platform'})
MERGE (sys)-[:MANAGES]->(schema:Schema {type: 'legal_contracts', version: '1.0'})
ON CREATE SET schema.created_at = datetime();