
if (typeof (Forms) == "undefined") {
    function Forms() { }
}

//////////////////////////// Form Creation

Forms.newFormInternal = function (templateid, linkedtable, linkedid, values) {
    var template = Query.selectId("Forms.templates", templateid);
    if (template == null) return null;

    var form = {};
    form.name = Forms.getNewName(templateid);
    form.templateid = templateid;
    form.date = Date.now();
    form.owner = User.getName();
    form.geo = Settings.getLocation();
    form.address = Settings.getAddress(form.geo);
    if (linkedtable != null) {
        form.linkedtable = linkedtable;
        form.linkedid = linkedid;
    } else {
        form.linkedtable = template.linkedtable;
    }

    if (values == null) values = {}; // must be an object not array for stringify
    Forms.setDefaultValues(form, values, Forms.DRAFT);
    form.value = JSON.stringify(values);

    return Query.insert("Forms.forms", form);
}

Forms.newPlanFormInternal = function (templateid, fileid, geo, linkedtable, linkedid) {
    var template = Query.selectId("Forms.templates", templateid);
    if (template == null) return null;

    var form = {};
    form.name = Forms.getNewName(templateid);
    form.templateid = templateid;
    form.date = Date.now();
    form.owner = User.getName();

    form.planid = fileid;
    form.geo = geo

    var file = Query.selectId("System.files", fileid);
    if (linkedtable == null && linkedid == null && file != null) {
        linkedid = file.linkedrecid;
        linkedtable = file.linkedtable;
        if (linkedtable == "unybiz.projects.projects") linkedtable = "Projects.projects";
    }
    
    form.linkedtable = linkedtable;
    form.linkedid = linkedid;

    // if no linked table and id, try to get it from the file itself
    var file = Query.selectId("System.files", fileid);
    if (form.linkedtable == null && form.linkedid == null && file != null) {
        var linkedtable = file.linkedtable;
        if (linkedtable == "unybiz.projects.projects") linkedtable = "Projects.projects";
        form.linkedtable = linkedtable;
        form.linkedid = file.linkedrecid;
    }

    var values = {}; // must be an object not array for stringify
    Forms.setDefaultValues(form, values, Forms.DRAFT);
    form.value = JSON.stringify(values);

    return Query.insert("Forms.forms", form);
}

Forms.getNewName = function (templateid) {
    var template = Query.selectId("Forms.templates", templateid);
    var counter = 1 + template.counter;
    Query.updateId("Forms.templates", templateid, "counter", counter);

    if (AccountSettings.get("forms.initials") == "1") {
        counter = User.getInitials() + "-" + counter;
    }
    return template.prefix + (template.prefix != "" ? "-" : "") + counter;
}

Forms.setDefaultValues = function (form, values, status) {
    var fields = Query.select("Forms.fields", "name;label;value;type", "status={status} AND formid={form.templateid}", "rank");
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var value = values[field.name];
        if (value == null) {
            if (field.type == "drawing") {
                value = (App.duplicatePicture != null) ? App.duplicatePicture(field.value, "Drawing " + form.name) : "";
                values[field.name] = value;
            } else if (field.type == "risk") {
                var risk = Query.selectId("Qhse.risks", field.label);
                if (risk != null) {
                    values[field.name + "S"] = risk.severity;
                    values[field.name + "P"] = risk.probability;
                }
            } else if (field.type != "header" && field.type != "label" && field.type != "image" && field.type != "button" && field.type != "formula") {
                value = Forms._eval(field.value, form); // to use javacript:// feature
                if (value != "") values[field.name] = value;
            }
        }
    }
}

/////////////////////

Forms.deleteForm = function(formid, goBack) {
    var form = Query.selectId("Forms.forms", formid);
    var files = Forms.selectFormPhotos(form);
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        Query.deleteId("System.files", file.id);
    }
    Query.deleteId("Forms.forms", formid);
    if (!(goBack === false)) History.back();
}

Forms.selectFormPhotos = function (form) {
    var files = [];
    var fields = Query.select("Forms.fields", "name", "type='photo' AND formid={form.templateid}");
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var value = form.id + ":" + field.name; // hack for photos.....
        var list = Query.select("System.files", "*", "linkedtable='Forms.forms' AND linkedrecid={value}", "date");
        files = files.concat(list);
    }
    return files;
}

Forms.changeOwner = function (id, owner) {
    var form = Query.selectId("Forms.forms", id);
    var files = Forms.selectFormPhotos(form);
    Query.updateId("Forms.forms", id, "owner", owner);
    // change the owner of the photos linked to the form too.
    for (var i = 0; i < files.length; i++) {
        Query.updateId("System.files", files[i].id, "owner", owner);
    }
}

/////////////////////

Forms.archiveForm = function (id, confirm) {
    if (confirm === true) {
        if (App.confirm("Confirm Archive") == false) return;
    }

    var form = Query.selectId("Forms.forms", id);
    var files = Forms.selectFormPhotos(form);
    for (var i = 0; i < files.length; i++) {
        Query.archiveId("System.files", files[i].id);
    }
    Query.archiveId("Forms.forms", id);
    if (confirm === true) History.back();
}

// if from == "DELETED"
Forms.restoreForm = function (id, reload, from) {
    var forms = Query.selectArchivedOrDeleted("Forms.forms", "*", "id={id}");
    if (forms.length == 0) return;
    var form = forms[0];

    // also restore the form photos...
    var files = [];
    var fields = Query.select("Forms.fields", "name", "type='photo' AND formid={form.templateid}");
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var linkedrecid = form.id + ":" + field.name; // hack for photos.....
        var list = Query.selectArchivedOrDeleted("System.files", "*", "linkedrecid={linkedrecid)");
        files = files.concat(list);
    }

    Query.restoreId("Forms.forms", form.id);
    for (var i = 0; i < files.length; i++) {
        Query.restoreId("System.files", files[i].id);
    }

    if (reload === true) {
        Cache.sync(function (changed) {
            History.reload("Forms.viewForm({id})");
        });
    }
}
