package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type AnytypeDB struct {
	client        *mongo.Client
	coordinatorDB *mongo.Database
	consensusDB   *mongo.Database
	mongoURL      string
}

// Connect to MongoDB
func New(mongoURL string) (*AnytypeDB, error) {
	if mongoURL == "" {
		mongoURL = "mongodb://127.0.0.1:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
	if err != nil {
		return nil, err
	}

	// Test connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, err
	}

	return &AnytypeDB{
		client:        client,
		coordinatorDB: client.Database("coordinator"),
		consensusDB:   client.Database("consensus"),
		mongoURL:      mongoURL,
	}, nil
}

// Disconnect from MongoDB
func (a *AnytypeDB) Disconnect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return a.client.Disconnect(ctx)
}

// List all spaces
func (a *AnytypeDB) ListSpaces() ([]bson.M, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	coll := a.coordinatorDB.Collection("spaces")
	cursor, err := coll.Find(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var spaces []bson.M
	if err = cursor.All(ctx, &spaces); err != nil {
		return nil, err
	}

	return spaces, nil
}

// Get space by ID
func (a *AnytypeDB) GetSpace(spaceID string) (bson.M, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	coll := a.coordinatorDB.Collection("spaces")
	var space bson.M
	err := coll.FindOne(ctx, bson.M{"_id": spaceID}).Decode(&space)
	return space, err
}

// Get payloads by space
func (a *AnytypeDB) GetPayloadsBySpace(spaceID string) ([]bson.M, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	coll := a.consensusDB.Collection("payload")
	
	// Match IDs that start with spaceID/
	filter := bson.M{
		"_id": bson.M{
			"$regex": "^" + regexp.QuoteMeta(spaceID) + "/",
		},
	}

	cursor, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var payloads []bson.M
	if err = cursor.All(ctx, &payloads); err != nil {
		return nil, err
	}

	return payloads, nil
}

// Count payloads
func (a *AnytypeDB) CountPayloads(spaceID string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	coll := a.consensusDB.Collection("payload")
	
	if spaceID == "" {
		return coll.EstimatedDocumentCount(ctx)
	}

	filter := bson.M{
		"_id": bson.M{
			"$regex": "^" + regexp.QuoteMeta(spaceID) + "/",
		},
	}
	return coll.CountDocuments(ctx, filter)
}

// Get recent activity
func (a *AnytypeDB) GetRecentActivity(spaceID string, limit int) ([]bson.M, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	coll := a.coordinatorDB.Collection("inboxMessages")
	
	filter := bson.M{}
	if spaceID != "" {
		filter["spaceId"] = spaceID
	}

	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(int64(limit))
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var activity []bson.M
	if err = cursor.All(ctx, &activity); err != nil {
		return nil, err
	}

	return activity, nil
}

// Get space summary
func (a *AnytypeDB) GetSpaceSummary(spaceID string) (map[string]interface{}, error) {
	count, err := a.CountPayloads(spaceID)
	if err != nil {
		return nil, err
	}

	activity, err := a.GetRecentActivity(spaceID, 5)
	if err != nil {
		return nil, err
	}

	var lastUpdated interface{}
	if len(activity) > 0 {
		lastUpdated = activity[0]["createdAt"]
	}

	return map[string]interface{}{
		"spaceId":       spaceID,
		"totalObjects":  count,
		"recentActivity": activity,
		"lastUpdated":   lastUpdated,
	}, nil
}

// Main CLI
func main() {
	mongoURL := flag.String("mongo", os.Getenv("MONGODB_URL"), "MongoDB URL")
	help := flag.Bool("help", false, "Show help")
	flag.Parse()

	if *help || len(os.Args) < 2 {
		printHelp()
		os.Exit(0)
	}

	// Default to local if not set
	if *mongoURL == "" {
		*mongoURL = "mongodb://127.0.0.1:27017"
	}

	db, err := New(*mongoURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer db.Disconnect()

	fmt.Println("✓ Connected to AnyType MongoDB")

	command := flag.Args()[0]
	args := flag.Args()[1:]

	switch command {
	case "spaces":
		cmdSpaces(db)
	case "space":
		if len(args) == 0 {
			log.Fatal("Space ID required")
		}
		cmdSpace(db, args[0])
	case "payloads":
		cmdPayloads(db)
	case "payloads-space":
		if len(args) == 0 {
			log.Fatal("Space ID required")
		}
		cmdPayloadsSpace(db, args[0])
	case "summary":
		if len(args) == 0 {
			log.Fatal("Space ID required")
		}
		cmdSummary(db, args[0])
	case "activity":
		if len(args) == 0 {
			log.Fatal("Space ID required")
		}
		cmdActivity(db, args[0])
	case "count":
		spaceID := ""
		if len(args) > 0 {
			spaceID = args[0]
		}
		cmdCount(db, spaceID)
	case "help":
		printHelp()
	default:
		log.Fatalf("Unknown command: %s", command)
	}
}

func cmdSpaces(db *AnytypeDB) {
	spaces, err := db.ListSpaces()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("\n%d spaces found:\n\n", len(spaces))
	for _, space := range spaces {
		fmt.Printf("  ID: %v\n", space["_id"])
		fmt.Printf("  Identity: %v\n", space["identity"])
		fmt.Printf("  Shareable: %v\n", space["isShareable"])
		fmt.Println()
	}
}

func cmdSpace(db *AnytypeDB, spaceID string) {
	space, err := db.GetSpace(spaceID)
	if err != nil {
		log.Fatal(err)
	}

	data, _ := json.MarshalIndent(space, "", "  ")
	fmt.Println("\nSpace info:")
	fmt.Println(string(data))
}

func cmdPayloads(db *AnytypeDB) {
	count, err := db.CountPayloads("")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("\n%d total payloads in MongoDB\n", count)
}

func cmdPayloadsSpace(db *AnytypeDB, spaceID string) {
	payloads, err := db.GetPayloadsBySpace(spaceID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("\n%d payloads in space %s\n", len(payloads), spaceID)
	
	limit := 5
	if len(payloads) < limit {
		limit = len(payloads)
	}
	
	for i := 0; i < limit; i++ {
		fmt.Printf("  %v\n", payloads[i]["_id"])
	}
	
	if len(payloads) > 5 {
		fmt.Printf("  ... and %d more\n", len(payloads)-5)
	}
}

func cmdSummary(db *AnytypeDB, spaceID string) {
	summary, err := db.GetSpaceSummary(spaceID)
	if err != nil {
		log.Fatal(err)
	}

	data, _ := json.MarshalIndent(summary, "", "  ")
	fmt.Println("\nSpace Summary:")
	fmt.Println(string(data))
}

func cmdActivity(db *AnytypeDB, spaceID string) {
	activity, err := db.GetRecentActivity(spaceID, 10)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("\n%d recent activities:\n\n", len(activity))
	for _, a := range activity {
		fmt.Printf("  %v: %v\n", a["createdAt"], a["type"])
	}
}

func cmdCount(db *AnytypeDB, spaceID string) {
	count, err := db.CountPayloads(spaceID)
	if err != nil {
		log.Fatal(err)
	}

	if spaceID == "" {
		fmt.Printf("\n%d total payloads\n", count)
	} else {
		fmt.Printf("\n%d payloads in space %s\n", count, spaceID)
	}
}

func printHelp() {
	fmt.Println(`
AnyType MongoDB Query Tool

Direct interface to AnyType's MongoDB storage.

Usage:
  anytype-db [command] [options]

Commands:
  spaces              List all spaces
  space <id>          Get space info
  payloads            Count total payloads
  payloads-space <id> Get payloads in a space
  summary <id>        Get space summary
  activity <id>       Get recent activity
  count [space-id]    Count payloads
  help                Show this help

Options:
  -mongo <url>        MongoDB URL (default: mongodb://127.0.0.1:27017)
  -help               Show help

Examples:
  anytype-db spaces
  anytype-db payloads-space bafyrei...
  anytype-db summary bafyrei...
  anytype-db count bafyrei...

Environment:
  MONGODB_URL         MongoDB connection string
`)
}
