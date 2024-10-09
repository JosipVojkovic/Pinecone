const express = require("express");
const mongoose = require("mongoose");
const Node = require("./models/node");

const app = express();
const port = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Node API");
});

// Dohvacanje stabla/cvora
app.get("/api/nodes", async (req, res) => {
  const { id } = req.query;

  try {
    if (id) {
      // Dohvacanje cvora
      const node = await Node.find({ id: id });
      res.status(200).send(node[0]);
    } else {
      // Dohvacanje cijelog stabla
      const nodes = await Node.find().sort({ parent_id: 1, ordering: 1 });
      res.send(nodes);
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Kreiranje cvora
app.post("/api/nodes", async (req, res) => {
  const { parent_id, title } = req.body;

  if (!parent_id || !title) {
    return res.status(400).send({ error: "Bad request!" });
  }

  try {
    const parent = await Node.find({ id: parent_id });

    console.log(parent);

    if (parent.length < 1) {
      return res.status(404).send({ error: "Node not found!" });
    }
    const maxOrder = await Node.find({ parent_id: parent_id })
      .sort({ ordering: -1 })
      .limit(1);

    const newOrdering = maxOrder.length > 0 ? maxOrder[0].ordering + 1 : 1;

    const lastNode = await Node.find().sort({ id: -1 }).limit(1);
    const newId = lastNode.length > 0 ? lastNode[0].id + 1 : 2;

    const newNode = new Node({
      id: newId,
      title,
      parent_id: parent_id,
      ordering: newOrdering,
    });
    await newNode.save();

    res.status(201).send(newNode);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Izmjena podataka cvora
app.put("/api/nodes/:id", async (req, res) => {
  const { title } = req.body;
  const { id } = req.params;

  try {
    const updatedNode = await Node.findOneAndUpdate(
      { id: Number(id) },
      { title },
      { new: true }
    );
    if (!updatedNode) {
      return res.status(404).send({ error: "Node not found!" });
    }
    res.send(updatedNode);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Brisanje cvora i svih njegovih podcvorova
app.delete("/api/nodes/:id", async (req, res) => {
  const { id } = req.params;

  if (Number(id) === 1) {
    return res.status(400).send({ error: "Can't delete root!" });
  }

  async function deleteNodeAndChildren(id) {
    const children = await Node.find({ parent_id: Number(id) });
    for (const child of children) {
      await deleteNodeAndChildren(child.id);
    }
    await Node.findOneAndDelete({ id: Number(id) });
  }

  try {
    await deleteNodeAndChildren(id);
    res.status(200).send({ message: "Successfully deleted!" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Premjestanje cvora (promjena njegovog parenta)
app.put("/api/nodes/changeParent/:id", async (req, res) => {
  const { id } = req.params;
  const { new_parent_id } = req.body;

  if (Number(id) === 1) {
    return res.status(400).send({ error: "Can't change root parent!" });
  }

  try {
    const nodeId = Number(id);
    const newParentId = Number(new_parent_id);

    const nodeToMove = await Node.findOne({ id: nodeId });
    if (!nodeToMove) {
      return res.status(404).send({ error: "Node not found!" });
    }

    let parentCheckId = newParentId;
    while (parentCheckId !== null) {
      const parentNode = await Node.findOne({ id: parentCheckId });
      if (!parentNode) {
        break;
      }

      if (parentNode.id === nodeId) {
        return res
          .status(400)
          .send({ error: "Can't move node to one of its own descendants!" });
      }
      parentCheckId = parentNode.parent_id;
    }

    const previousParentId = nodeToMove.parent_id;

    await Node.updateMany(
      { parent_id: previousParentId, ordering: { $gt: nodeToMove.ordering } },
      { $inc: { ordering: -1 } }
    );

    const maxOrder = await Node.find({ parent_id: newParentId })
      .sort({ ordering: -1 })
      .limit(1);
    const newOrdering = maxOrder.length > 0 ? maxOrder[0].ordering + 1 : 1;

    const updatedNode = await Node.findOneAndUpdate(
      { id: nodeId },
      { parent_id: newParentId, ordering: newOrdering },
      { new: true }
    );

    if (!updatedNode) {
      return res.status(404).send({ error: "Node not found!" });
    }

    res.send(updatedNode);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.put("/api/nodes/changeOrder/:id", async (req, res) => {
  const { id } = req.params;
  const { new_ordering } = req.body;

  try {
    const node = await Node.findOne({ id: Number(id) });
    if (!node) {
      return res.status(404).send({ error: "Node not found!" });
    }

    const siblings = await Node.find({ parent_id: node.parent_id }).sort({
      ordering: 1,
    });

    siblings.splice(
      siblings.findIndex((s) => s.id === Number(id)),
      1
    );
    siblings.splice(new_ordering - 1, 0, node);

    console.log(siblings);

    for (let index = 0; index < siblings.length; index++) {
      const sibling = siblings[index];
      siblings[index].ordering = index + 1;
      await Node.findOneAndUpdate({ id: sibling.id }, { ordering: index + 1 });
    }

    res.send(siblings);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

mongoose
  .connect(
    "mongodb+srv://josipvojkovic0:S6JxaCxSVdzhVdEi@pineconedb.40xvu.mongodb.net/?retryWrites=true&w=majority&appName=PineconeDB"
  )
  .then(() => {
    console.log("Connected to the database!");
    app.listen(port, () => {
      console.log(`Server listening at port: ${port}`);
    });
  })
  .catch(() => {
    console.log("Connection failed!");
  });
